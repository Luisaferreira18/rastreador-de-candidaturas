/**
 * Executa a busca de um usuário e grava as vagas novas. Funciona com a sessão
 * da própria pessoa (botão "Buscar agora", RLS ativo) e com o cliente
 * administrativo (cron diário, que passa por todos os perfis).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/format";
import type { Database, Json, Tables, TablesInsert } from "@/types/database";
import { toSearchProfile } from "./profile";
import { MAX_NEW_PER_RUN, buildSkipCheck, collectJobs, rankJobs, tasksForProfile, type JobCache } from "./search";
import { fetchJson as defaultFetchJson, type FetchJson } from "./sources/http";
import type { SearchStats } from "./types";

type Client = SupabaseClient<Database>;

/** Busca automática: no máximo uma vez a cada 20 horas. */
export const AUTO_INTERVAL_MS = 20 * 60 * 60 * 1000;
/** Botão "Buscar agora": no máximo uma vez a cada 2 minutos. */
export const MANUAL_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Marca o início da busca, se a última foi há mais de `intervalMs`.
 * Devolve o perfil, ou null se outra busca rodou há pouco (outra aba, o cron).
 */
export async function claimSearch(supabase: Client, userId: string, intervalMs: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - intervalMs).toISOString();
  const { data, error } = await supabase
    .from("job_profiles")
    .update({ last_run_at: now.toISOString() })
    .eq("user_id", userId)
    .or(`last_run_at.is.null,last_run_at.lt."${cutoff}"`)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function runSearchForUser(
  supabase: Client,
  userId: string,
  profileRow: Tables<"job_profiles">,
  options: { fetchJson?: FetchJson; cache?: JobCache; today?: string } = {},
): Promise<SearchStats> {
  const profile = toSearchProfile(profileRow);
  const today = options.today ?? todayISO();

  const [existing, applications] = await Promise.all([
    supabase.from("job_leads").select("source, external_id").eq("user_id", userId).limit(20_000),
    supabase.from("applications").select("company, role_title, job_url").eq("user_id", userId),
  ]);
  if (existing.error) throw existing.error;
  if (applications.error) throw applications.error;

  const tasks = tasksForProfile(profile);
  const { jobs, errors } = await collectJobs(tasks, options.fetchJson ?? defaultFetchJson, options.cache);
  const ranked = rankJobs(jobs, profile, today);
  const skip = buildSkipCheck(existing.data ?? [], applications.data ?? []);
  const fresh = ranked.filter((job) => !skip(job)).slice(0, MAX_NEW_PER_RUN);

  let added = 0;
  if (fresh.length > 0) {
    const rows: TablesInsert<"job_leads">[] = fresh.map((job) => ({
      user_id: userId,
      source: job.source,
      external_id: job.externalId,
      company: job.company,
      title: job.title,
      url: job.url,
      location: job.location,
      work_model: job.workModel,
      job_type: job.jobType,
      salary_cents: job.salaryCents,
      published_at: job.publishedAt,
      deadline: job.deadline,
      score: job.score,
      reasons: job.reasons.slice(0, 10),
      warnings: job.warnings.slice(0, 10),
    }));
    const { data, error } = await supabase
      .from("job_leads")
      .upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    added = data?.length ?? 0;
  }

  const stats: SearchStats = {
    analyzed: jobs.length,
    matched: ranked.length,
    added,
    sources: tasks.length,
    errors,
    finishedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("job_profiles")
    .update({ last_run_stats: stats as unknown as Json })
    .eq("user_id", userId);
  if (error) throw error;
  return stats;
}

/** Lê o resumo guardado no perfil (com tolerância a formatos antigos). */
export function parseStats(value: Json | null): SearchStats | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return {
    analyzed: Number(data.analyzed ?? 0),
    matched: Number(data.matched ?? 0),
    added: Number(data.added ?? 0),
    sources: Number(data.sources ?? 0),
    errors: Array.isArray(data.errors) ? data.errors.filter((error): error is string => typeof error === "string") : [],
    finishedAt: typeof data.finishedAt === "string" ? data.finishedAt : "",
  };
}

/**
 * Executa o caça-concursos:
 * - `refreshCatalog`: baixa as fontes e grava os editais novos no catálogo
 *   compartilhado (precisa do cliente administrativo, com a chave secreta);
 * - `scoreForUser`: dá a nota de cada edital do catálogo para o perfil da
 *   pessoa e grava as sugestões novas (funciona com a sessão dela).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, todayISO } from "@/lib/format";
import type { Database, Json, Tables, TablesInsert } from "@/types/database";
import { fetchDouNotices } from "./dou";
import { defaultFetcher, SourceError, type Fetcher } from "./http";
import { toConcursoSearchProfile } from "./profile";
import { fetchQueridoDiario } from "./querido-diario";
import { MIN_CONCURSO_SCORE, scoreNotice } from "./score";
import { noticeToRow, rowToNotice } from "./rows";
import type { CatalogNotice, CityCoverage, ConcursoSearchStats } from "./types";

export { noticeToRow, rowToNotice };

type Client = SupabaseClient<Database>;
type NoticeRow = Tables<"concurso_notices">;

/** Busca automática: no máximo uma vez a cada 20 horas. Botão: a cada 2 minutos. */
export const AUTO_INTERVAL_MS = 20 * 60 * 60 * 1000;
export const MANUAL_INTERVAL_MS = 2 * 60 * 1000;
/** O DOU é lido no máximo a cada 6 horas (o arquivo é grande e muda uma vez por dia). */
const DOU_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Na primeira leitura, os últimos dias do DOU; nos diários das cidades, o último mês. */
const DOU_FIRST_DAYS = 5;
const QD_WINDOW_DAYS = 30;
/** Editais mais antigos que isso não viram sugestão nova. */
const CATALOG_WINDOW_DAYS = 120;
export const MAX_NEW_PER_RUN = 30;

export function inlabsCredentials(): { email: string; password: string } | null {
  const email = process.env.INLABS_EMAIL;
  const password = process.env.INLABS_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Dias de `from` até `to`, inclusive. */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 40; day = addDaysISO(day, 1)) days.push(day);
  return days;
}

/**
 * Atualiza o catálogo: DOU (dias ainda não lidos) e os diários das cidades
 * pedidas. Uma fonte fora do ar não impede a outra.
 */
export async function refreshCatalog(
  admin: Client,
  options: { places: readonly string[]; fetcher?: Fetcher; today?: string; now?: Date },
): Promise<{ added: number; errors: string[]; coverage: CityCoverage[] }> {
  const fetcher = options.fetcher ?? defaultFetcher;
  const today = options.today ?? todayISO();
  const now = options.now ?? new Date();
  const errors: string[] = [];
  const notices: CatalogNotice[] = [];
  let coverage: CityCoverage[] = [];

  const runs = await admin.from("concurso_source_runs").select("*");
  if (runs.error) throw runs.error;
  const douRun = runs.data?.find((run) => run.source === "dou");

  const douFresh = douRun?.last_run_at && now.getTime() - Date.parse(douRun.last_run_at) < DOU_INTERVAL_MS && douRun.last_date === today;
  if (!douFresh) {
    const start = douRun?.last_date && douRun.last_date < today ? douRun.last_date : addDaysISO(today, -DOU_FIRST_DAYS);
    try {
      const dou = await fetchDouNotices(fetcher, daysBetween(start, today), today, inlabsCredentials());
      notices.push(...dou.notices);
      if (dou.warning) errors.push(dou.warning);
      const saved = await admin.from("concurso_source_runs").upsert({
        source: "dou",
        last_date: today,
        last_run_at: now.toISOString(),
        stats: { found: dou.notices.length, via: dou.via } as Json,
      });
      if (saved.error) throw saved.error;
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      errors.push(`Diário Oficial da União: ${error.message}`);
    }
  }

  try {
    const qd = await fetchQueridoDiario(fetcher, options.places, addDaysISO(today, -QD_WINDOW_DAYS), today);
    notices.push(...qd.notices);
    coverage = qd.coverage;
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    errors.push(`Querido Diário: ${error.message}`);
  }

  let added = 0;
  if (notices.length > 0) {
    const { data, error } = await admin
      .from("concurso_notices")
      .upsert(notices.map(noticeToRow), { onConflict: "source,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    added = data?.length ?? 0;
  }
  return { added, errors, coverage };
}

/** Marca o início da busca, se a última foi há mais de `intervalMs` (como no caça-vagas). */
export async function claimConcursoSearch(supabase: Client, userId: string, intervalMs: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - intervalMs).toISOString();
  const { data, error } = await supabase
    .from("concurso_profiles")
    .update({ last_run_at: now.toISOString() })
    .eq("user_id", userId)
    .or(`last_run_at.is.null,last_run_at.lt."${cutoff}"`)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Dá a nota dos editais recentes do catálogo para o perfil e grava as
 * sugestões novas. Edital já sugerido (mesmo descartado) não volta.
 */
export async function scoreForUser(
  supabase: Client,
  userId: string,
  profileRow: Tables<"concurso_profiles">,
  options: { today?: string; errors?: string[]; coverage?: CityCoverage[]; catalogUpdated?: boolean } = {},
): Promise<ConcursoSearchStats> {
  const today = options.today ?? todayISO();
  const profile = toConcursoSearchProfile(profileRow);
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - CATALOG_WINDOW_DAYS * 86_400_000).toISOString();

  const [catalog, existing] = await Promise.all([
    supabase.from("concurso_notices").select("*").gte("found_at", since).order("found_at", { ascending: false }).limit(2000),
    supabase.from("concurso_leads").select("notice_id").eq("user_id", userId).limit(10_000),
  ]);
  if (catalog.error) throw catalog.error;
  if (existing.error) throw existing.error;

  const seen = new Set((existing.data ?? []).map((lead) => lead.notice_id));
  const scored = (catalog.data ?? [])
    .map((row) => ({ row, match: scoreNotice(rowToNotice(row), profile, today) }))
    .filter((item): item is { row: NoticeRow; match: Extract<ReturnType<typeof scoreNotice>, { excluded: false }> } =>
      !item.match.excluded && item.match.score >= MIN_CONCURSO_SCORE,
    )
    .sort((a, b) => b.match.score - a.match.score);
  const fresh = scored.filter((item) => !seen.has(item.row.id)).slice(0, MAX_NEW_PER_RUN);

  let added = 0;
  if (fresh.length > 0) {
    const rows: TablesInsert<"concurso_leads">[] = fresh.map(({ row, match }) => ({
      user_id: userId,
      notice_id: row.id,
      role: match.role?.slice(0, 200) ?? null,
      score: match.score,
      reasons: match.reasons.slice(0, 10),
      warnings: match.warnings.slice(0, 10),
    }));
    const { data, error } = await supabase
      .from("concurso_leads")
      .upsert(rows, { onConflict: "user_id,notice_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    added = data?.length ?? 0;
  }

  const stats: ConcursoSearchStats = {
    analyzed: catalog.data?.length ?? 0,
    matched: scored.length,
    added,
    errors: options.errors ?? [],
    coverage: options.coverage ?? [],
    catalogUpdated: options.catalogUpdated ?? false,
    finishedAt: new Date().toISOString(),
  };
  const saved = await supabase
    .from("concurso_profiles")
    .update({ last_run_stats: stats as unknown as Json })
    .eq("user_id", userId);
  if (saved.error) throw saved.error;
  return stats;
}

/** Lê o resumo guardado no perfil (com tolerância a formatos antigos). */
export function parseConcursoStats(value: Json | null): ConcursoSearchStats | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return {
    analyzed: Number(data.analyzed ?? 0),
    matched: Number(data.matched ?? 0),
    added: Number(data.added ?? 0),
    errors: Array.isArray(data.errors) ? data.errors.filter((item): item is string => typeof item === "string") : [],
    coverage: Array.isArray(data.coverage) ? (data.coverage as CityCoverage[]) : [],
    catalogUpdated: data.catalogUpdated === true,
    finishedAt: typeof data.finishedAt === "string" ? data.finishedAt : "",
  };
}

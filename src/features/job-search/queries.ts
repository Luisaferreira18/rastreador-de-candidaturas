import "server-only";
import { requireUser } from "@/features/auth/session";
import { friendlyDbError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { JobLead } from "./lead";
import { parseStats } from "./run";
import type { SearchStats } from "./types";

export type JobSearchData = {
  profile: Tables<"job_profiles"> | null;
  stats: SearchStats | null;
  leads: { nova: JobLead[]; adicionada: JobLead[]; descartada: JobLead[] };
};

function loadError(error: unknown): Error {
  return new Error(friendlyDbError(error, "Não foi possível carregar as vagas sugeridas."));
}

export async function getJobSearchData(): Promise<JobSearchData> {
  const user = await requireUser();
  const supabase = await createClient();

  const leadsWith = (status: JobLead["status"], limit: number) => {
    const query = supabase.from("job_leads").select("*").eq("user_id", user.id).eq("status", status);
    return status === "nova"
      ? query.order("score", { ascending: false }).order("found_at", { ascending: false }).limit(limit)
      : query.order("resolved_at", { ascending: false }).limit(limit);
  };

  const [profile, nova, adicionada, descartada] = await Promise.all([
    supabase.from("job_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    leadsWith("nova", 150),
    leadsWith("adicionada", 50),
    leadsWith("descartada", 50),
  ]);
  for (const result of [profile, nova, adicionada, descartada]) {
    if (result.error) throw loadError(result.error);
  }

  return {
    profile: profile.data,
    stats: parseStats(profile.data?.last_run_stats ?? null),
    leads: { nova: nova.data ?? [], adicionada: adicionada.data ?? [], descartada: descartada.data ?? [] },
  };
}

export async function getJobProfile(): Promise<Tables<"job_profiles"> | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw loadError(error);
  return data;
}

/** Quantas vagas novas esperam (para o número no menu). */
export async function countNewLeads(): Promise<number> {
  const user = await requireUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("job_leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "nova");
  if (error) return 0;
  return count ?? 0;
}

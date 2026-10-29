import "server-only";
import { requireUser } from "@/features/auth/session";
import { friendlyDbError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { ConcursoLeadWithNotice } from "./lead";
import { parseConcursoStats } from "./run";
import type { ConcursoSearchStats } from "./types";

export type ConcursoSearchData = {
  profile: Tables<"concurso_profiles"> | null;
  stats: ConcursoSearchStats | null;
  leads: { nova: ConcursoLeadWithNotice[]; acompanhando: ConcursoLeadWithNotice[]; descartada: ConcursoLeadWithNotice[] };
};

function loadError(error: unknown): Error {
  return new Error(friendlyDbError(error, "Não foi possível carregar os concursos sugeridos."));
}

export async function getConcursoSearchData(): Promise<ConcursoSearchData> {
  const user = await requireUser();
  const supabase = await createClient();

  const leadsWith = (status: ConcursoLeadWithNotice["status"], limit: number) => {
    const query = supabase
      .from("concurso_leads")
      .select("*, notice:concurso_notices(*)")
      .eq("user_id", user.id)
      .eq("status", status);
    return status === "nova"
      ? query.order("score", { ascending: false }).order("found_at", { ascending: false }).limit(limit)
      : query.order("resolved_at", { ascending: false }).limit(limit);
  };

  const [profile, nova, acompanhando, descartada] = await Promise.all([
    supabase.from("concurso_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    leadsWith("nova", 150),
    leadsWith("acompanhando", 50),
    leadsWith("descartada", 50),
  ]);
  for (const result of [profile, nova, acompanhando, descartada]) {
    if (result.error) throw loadError(result.error);
  }
  const withNotice = (rows: typeof nova.data) =>
    (rows ?? []).filter((row): row is ConcursoLeadWithNotice => row.notice !== null);

  return {
    profile: profile.data,
    stats: parseConcursoStats(profile.data?.last_run_stats ?? null),
    leads: { nova: withNotice(nova.data), acompanhando: withNotice(acompanhando.data), descartada: withNotice(descartada.data) },
  };
}

export async function getConcursoProfile(): Promise<Tables<"concurso_profiles"> | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("concurso_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw loadError(error);
  return data;
}

/** Quantos concursos novos esperam (para o número no menu). */
export async function countNewConcursoLeads(): Promise<number> {
  const user = await requireUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("concurso_leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "nova");
  if (error) return 0;
  return count ?? 0;
}

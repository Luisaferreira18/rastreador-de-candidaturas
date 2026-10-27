import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database, Json } from "@/types/database";
import type { ReportSnapshot } from "./build";

export class InvalidTokenError extends Error {
  constructor() {
    super("Token inválido.");
    this.name = "InvalidTokenError";
  }
}

/** Converte o JSON devolvido pela função report_snapshot do banco. */
export function parseSnapshot(json: Json): ReportSnapshot {
  const data = (json ?? {}) as Record<string, unknown>;
  return {
    applications: (data.applications as ReportSnapshot["applications"]) ?? [],
    history: (data.history as ReportSnapshot["history"]) ?? [],
    tasks: (data.tasks as ReportSnapshot["tasks"]) ?? [],
    pendingSuggestions: Number(data.pending_suggestions ?? 0),
    newLeads: (data.new_leads as ReportSnapshot["newLeads"]) ?? [],
    newLeadsCount: Number(data.new_leads_count ?? 0),
  };
}

/** Pelo token do script do Google (sem sessão; usado pelo /api/report). */
export async function loadSnapshotByToken(token: string): Promise<ReportSnapshot> {
  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("report_snapshot", { p_token: token });
  if (error) {
    if (error.code === "28000") throw new InvalidTokenError();
    throw error;
  }
  return parseSnapshot(data);
}

/**
 * Por id de usuário: com a sessão da própria pessoa (prévia no app, RLS ativo)
 * ou com o cliente administrativo (assistente do WhatsApp).
 */
export async function loadSnapshotForUser(supabase: SupabaseClient<Database>, userId: string): Promise<ReportSnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [applications, history, tasks, suggestions, leads, leadsCount] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company, role_title, stage, platform, stage_changed_at, applied_at, created_at")
      .eq("user_id", userId),
    supabase.from("stage_history").select("application_id, from_stage, to_stage, changed_at").eq("user_id", userId),
    supabase.from("tasks").select("application_id, title, due_date").eq("user_id", userId).eq("done", false),
    supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pendente"),
    supabase
      .from("job_leads")
      .select("company, title, url, score")
      .eq("user_id", userId)
      .eq("status", "nova")
      .gte("found_at", since)
      .order("score", { ascending: false })
      .order("found_at", { ascending: false })
      .limit(5),
    supabase
      .from("job_leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "nova")
      .gte("found_at", since),
  ]);
  for (const result of [applications, history, tasks, suggestions, leads, leadsCount]) {
    if (result.error) throw result.error;
  }
  return {
    applications: applications.data ?? [],
    history: history.data ?? [],
    tasks: tasks.data ?? [],
    pendingSuggestions: suggestions.count ?? 0,
    newLeads: leads.data ?? [],
    newLeadsCount: leadsCount.count ?? 0,
  };
}

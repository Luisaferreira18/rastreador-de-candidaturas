import "server-only";
import { requireUser } from "@/features/auth/session";
import { friendlyDbError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type InboxItem = Tables<"inbox_items">;

export type InboxData = {
  pending: InboxItem[];
  history: InboxItem[];
  applications: { id: string; company: string; role_title: string; stage: Tables<"applications">["stage"]; applied_at: string | null; updated_at: string }[];
  settings: { hasToken: boolean; tokenCreatedAt: string | null; autoApply: boolean; lastEmailAt: string | null };
};

function loadError(error: unknown): Error {
  return new Error(friendlyDbError(error, "Não foi possível carregar a caixa de entrada."));
}

export async function getInboxData(): Promise<InboxData> {
  const user = await requireUser();
  const supabase = await createClient();

  const [pending, history, applications, settings, lastEmail] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("inbox_items")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "pendente")
      .order("resolved_at", { ascending: false })
      .limit(30),
    supabase
      .from("applications")
      .select("id, company, role_title, stage, applied_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("inbox_items")
      .select("received_at")
      .eq("user_id", user.id)
      .eq("source", "email")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const result of [pending, history, applications, settings, lastEmail]) {
    if (result.error) throw loadError(result.error);
  }

  return {
    pending: pending.data ?? [],
    history: history.data ?? [],
    applications: applications.data ?? [],
    settings: {
      hasToken: Boolean(settings.data?.inbox_token_hash),
      tokenCreatedAt: settings.data?.inbox_token_created_at ?? null,
      autoApply: settings.data?.auto_apply ?? true,
      lastEmailAt: lastEmail.data?.received_at ?? null,
    },
  };
}

/** Quantas sugestões esperam por você (para o número no menu). */
export async function countPendingInbox(): Promise<number> {
  const user = await requireUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pendente");
  if (error) return 0;
  return count ?? 0;
}

import "server-only";
import { requireUser } from "@/features/auth/session";
import { friendlyDbError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { Resume } from "./resume";

export async function getResume(): Promise<Resume | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("resumes").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(friendlyDbError(error, "Não foi possível carregar o currículo."));
  return data;
}

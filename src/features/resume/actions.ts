"use server";

import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { DEMO_RESUME_MESSAGE, RESUME_BUCKET, resumePath } from "./resume";

/** Apaga o arquivo e o que foi lido dele. As vagas passam a usar só o perfil. */
export async function deleteResume(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return failure("Sua sessão expirou. Entre novamente para continuar.");
  if (user.isDemo) return failure(DEMO_RESUME_MESSAGE);
  const supabase = await createClient();

  const removed = await supabase.storage.from(RESUME_BUCKET).remove([resumePath(user.id)]);
  if (removed.error) return failure(friendlyDbError(removed.error, "Não foi possível apagar o arquivo. Tente novamente."));

  const { error } = await supabase.from("resumes").delete().eq("user_id", user.id);
  if (error) return failure(friendlyDbError(error, "Não foi possível apagar o currículo. Tente novamente."));

  // A próxima busca já roda sem as habilidades do currículo.
  const profile = await supabase.from("job_profiles").update({ last_run_at: null }).eq("user_id", user.id);
  if (profile.error) return failure(friendlyDbError(profile.error));

  revalidateApp();
  return success();
}

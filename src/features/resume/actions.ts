"use server";

import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, type ActionResult } from "@/lib/action-result";
import { todayISO } from "@/lib/format";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { suggestedJobTypes, suggestedRoles } from "./extract";
import { DEMO_RESUME_MESSAGE, RESUME_BUCKET, educationFormSchema, resumePath, type EducationFormValues, type Resume } from "./resume";

/** Corrige a formação lida do PDF e libera uma busca nova, que já usa a correção. */
export async function updateResumeEducation(values: EducationFormValues): Promise<ActionResult<{ resume: Resume }>> {
  const user = await getCurrentUser();
  if (!user) return failure("Sua sessão expirou. Entre novamente para continuar.");
  if (user.isDemo) return failure(DEMO_RESUME_MESSAGE);

  const parsed = educationFormSchema.safeParse(values);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Revise a formação.");
  const { course, status, graduationYear } = parsed.data;

  const supabase = await createClient();
  const current = await supabase.from("resumes").select("skills").eq("user_id", user.id).maybeSingle();
  if (current.error) return failure(friendlyDbError(current.error));
  if (!current.data) return failure("Envie o currículo antes de corrigir a formação.");

  const { data, error } = await supabase
    .from("resumes")
    .update({
      course,
      education_status: status,
      graduation_year: graduationYear,
      suggested_roles: suggestedRoles(course, current.data.skills, status),
      suggested_job_types: suggestedJobTypes(status, graduationYear, Number(todayISO().slice(0, 4))),
    })
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return failure(friendlyDbError(error, "Não foi possível salvar a formação. Tente novamente."));

  const profile = await supabase.from("job_profiles").update({ last_run_at: null }).eq("user_id", user.id);
  if (profile.error) return failure(friendlyDbError(profile.error));

  revalidateApp();
  return success({ resume: data });
}

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

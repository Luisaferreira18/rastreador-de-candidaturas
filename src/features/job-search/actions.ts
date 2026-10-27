"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { leadToApplication } from "./lead";
import { jobProfileFormSchema, toJobProfilePayload, type JobProfileFormValues } from "./profile";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";
const LEAD_NOT_FOUND = "Essa vaga não está mais na lista. Atualize a página.";
const idSchema = z.uuid();

/**
 * Salva o perfil de busca. As sugestões ainda não vistas são refeitas com o
 * perfil novo: a tela dispara uma busca logo depois de salvar.
 */
export async function saveJobProfile(values: JobProfileFormValues): Promise<ActionResult> {
  const parsed = jobProfileFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();

  const { error } = await supabase.from("job_profiles").upsert(
    {
      ...toJobProfilePayload(parsed.data),
      user_id: user.id,
      // Libera a próxima busca na hora, já com o perfil novo.
      last_run_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return failure(friendlyDbError(error, "Não foi possível salvar o perfil. Tente novamente."));

  const cleanup = await supabase.from("job_leads").delete().eq("user_id", user.id).eq("status", "nova");
  if (cleanup.error) return failure(friendlyDbError(cleanup.error));

  revalidateApp();
  return success();
}

/** Cria a candidatura em "Quero me candidatar" a partir da vaga sugerida. */
export async function addLeadToBoard(leadId: string): Promise<ActionResult<{ applicationId: string }>> {
  if (!idSchema.safeParse(leadId).success) return failure(LEAD_NOT_FOUND);
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();

  try {
    const [lead, profile] = await Promise.all([
      supabase.from("job_leads").select("*").eq("id", leadId).eq("user_id", user.id).maybeSingle(),
      supabase.from("job_profiles").select("job_types").eq("user_id", user.id).maybeSingle(),
    ]);
    if (lead.error) throw lead.error;
    if (!lead.data) return failure(LEAD_NOT_FOUND);
    if (lead.data.status === "adicionada" && lead.data.application_id) {
      return success({ applicationId: lead.data.application_id });
    }

    const { data: application, error } = await supabase
      .from("applications")
      .insert({ ...leadToApplication(lead.data, profile.data?.job_types ?? []), user_id: user.id })
      .select("id")
      .single();
    if (error) throw error;

    const update = await supabase
      .from("job_leads")
      .update({ status: "adicionada", application_id: application.id, resolved_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("user_id", user.id);
    if (update.error) throw update.error;

    revalidateApp();
    return success({ applicationId: application.id });
  } catch (error) {
    return failure(friendlyDbError(error, "Não foi possível adicionar a vaga ao quadro. Tente novamente."));
  }
}

async function setLeadStatus(leadId: string, from: "nova" | "descartada", to: "nova" | "descartada"): Promise<ActionResult> {
  if (!idSchema.safeParse(leadId).success) return failure(LEAD_NOT_FOUND);
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_leads")
    .update({ status: to, resolved_at: to === "nova" ? null : new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", user.id)
    .eq("status", from)
    .select("id")
    .maybeSingle();
  if (error) return failure(friendlyDbError(error));
  if (!data) return failure(LEAD_NOT_FOUND);

  revalidateApp();
  return success();
}

/** Tira a vaga da lista; ela não volta nas próximas buscas. */
export async function dismissLead(leadId: string): Promise<ActionResult> {
  return setLeadStatus(leadId, "nova", "descartada");
}

/** Devolve uma vaga descartada para a lista de novas. */
export async function restoreLead(leadId: string): Promise<ActionResult> {
  return setLeadStatus(leadId, "descartada", "nova");
}

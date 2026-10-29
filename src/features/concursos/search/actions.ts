"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { leadToConcurso } from "./lead";
import { concursoProfileFormSchema, toConcursoProfilePayload, type ConcursoProfileFormValues } from "./profile";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";
const LEAD_NOT_FOUND = "Esse concurso não está mais na lista. Atualize a página.";
const idSchema = z.uuid();

/**
 * Salva o perfil de concursos. As sugestões ainda não vistas são refeitas com
 * o perfil novo: a tela dispara uma busca logo depois de salvar.
 */
export async function saveConcursoProfile(values: ConcursoProfileFormValues): Promise<ActionResult> {
  const parsed = concursoProfileFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();

  const { error } = await supabase.from("concurso_profiles").upsert(
    {
      ...toConcursoProfilePayload(parsed.data),
      user_id: user.id,
      // Libera a próxima busca na hora, já com o perfil novo.
      last_run_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return failure(friendlyDbError(error, "Não foi possível salvar o perfil. Tente novamente."));

  const cleanup = await supabase.from("concurso_leads").delete().eq("user_id", user.id).eq("status", "nova");
  if (cleanup.error) return failure(friendlyDbError(cleanup.error));

  revalidateApp();
  return success();
}

/** "Acompanhar": cria o concurso no quadro, com o cronograma do edital. */
export async function followConcursoLead(leadId: string): Promise<ActionResult<{ concursoId: string }>> {
  if (!idSchema.safeParse(leadId).success) return failure(LEAD_NOT_FOUND);
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("concurso_leads")
    .select("*, notice:concurso_notices(*)")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return failure(friendlyDbError(error));
  if (!lead || !lead.notice) return failure(LEAD_NOT_FOUND);
  if (lead.status === "acompanhando" && lead.concurso_id) return success({ concursoId: lead.concurso_id });

  const { notice, ...leadRow } = lead;
  const plan = leadToConcurso(leadRow, notice);
  const created = await supabase
    .from("concursos")
    .insert({ ...plan.concurso, user_id: user.id })
    .select("id")
    .single();
  if (created.error) return failure(friendlyDbError(created.error, "Não foi possível criar o concurso. Tente novamente."));

  if (plan.dates.length > 0) {
    const dates = await supabase
      .from("concurso_dates")
      .insert(plan.dates.map((item) => ({ ...item, concurso_id: created.data.id, user_id: user.id })));
    if (dates.error) {
      await supabase.from("concursos").delete().eq("id", created.data.id).eq("user_id", user.id);
      return failure(friendlyDbError(dates.error, "Não foi possível salvar o cronograma. Tente novamente."));
    }
  }

  const updated = await supabase
    .from("concurso_leads")
    .update({ status: "acompanhando", concurso_id: created.data.id, resolved_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", user.id);
  if (updated.error) return failure(friendlyDbError(updated.error));

  revalidateApp();
  return success({ concursoId: created.data.id });
}

async function setLeadStatus(leadId: string, status: "nova" | "descartada"): Promise<ActionResult> {
  if (!idSchema.safeParse(leadId).success) return failure(LEAD_NOT_FOUND);
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("concurso_leads")
    .update({ status, resolved_at: status === "nova" ? null : new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", user.id)
    // Concurso já acompanhado não volta para a lista nem é descartado por aqui.
    .neq("status", "acompanhando")
    .select("id");
  if (error) return failure(friendlyDbError(error));
  if (!data || data.length === 0) return failure(LEAD_NOT_FOUND);
  revalidateApp();
  return success();
}

/** Descartar: o edital some da lista e não volta nas próximas buscas. */
export async function dismissConcursoLead(leadId: string): Promise<ActionResult> {
  return setLeadStatus(leadId, "descartada");
}

export async function restoreConcursoLead(leadId: string): Promise<ActionResult> {
  return setLeadStatus(leadId, "nova");
}

"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { topPosition } from "@/features/board/board-state";
import { failure, friendlyDbError, success, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import type { StageKey } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import {
  applicationFormSchema,
  moveApplicationSchema,
  toApplicationPayload,
  undoMoveSchema,
  type ApplicationFormValues,
  type MoveApplicationInput,
  type UndoMoveInput,
} from "./schema";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";
const NOT_FOUND = "Não encontramos essa candidatura. Ela pode ter sido excluída.";
const idSchema = z.uuid();

export async function createApplication(values: ApplicationFormValues): Promise<ActionResult<{ id: string }>> {
  const parsed = applicationFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .insert({ ...toApplicationPayload(parsed.data), user_id: user.id, position: topPosition() })
    .select("id")
    .single();

  if (error) return failure(friendlyDbError(error, "Não foi possível criar a candidatura. Tente novamente."));

  revalidateApp();
  return success({ id: data.id });
}

export async function updateApplication(
  id: string,
  values: ApplicationFormValues,
): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return failure(NOT_FOUND);
  const parsed = applicationFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const current = await supabase
    .from("applications")
    .select("stage")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (current.error) return failure(friendlyDbError(current.error));
  if (!current.data) return failure(NOT_FOUND);

  const payload = toApplicationPayload(parsed.data);
  const stageChanged = payload.stage !== current.data.stage;

  const { data, error } = await supabase
    .from("applications")
    // Mudou de etapa pelo formulário: vai para o topo da nova coluna.
    .update(stageChanged ? { ...payload, position: topPosition() } : payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return failure(friendlyDbError(error, "Não foi possível salvar as alterações. Tente novamente."));
  if (!data) return failure(NOT_FOUND);

  revalidateApp();
  return success({ id: data.id });
}

/**
 * Muda a etapa (e opcionalmente a posição no Kanban). O registro no histórico
 * é feito por um trigger no banco, então não depende de quem chamou.
 */
export async function moveApplication(
  input: MoveApplicationInput,
): Promise<ActionResult<{ id: string; stage: StageKey; position: number; stage_changed_at: string }>> {
  const parsed = moveApplicationSchema.safeParse(input);
  if (!parsed.success) return failure("Não foi possível mover: dados inválidos.");

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ stage: parsed.data.stage, position: parsed.data.position ?? topPosition() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id, stage, position, stage_changed_at")
    .maybeSingle();

  if (error) return failure(friendlyDbError(error, "Não foi possível mover a candidatura. Tente novamente."));
  if (!data) return failure(NOT_FOUND);

  revalidateApp();
  return success(data);
}

/**
 * Desfaz uma mudança de etapa feita há pouco. Diferente de mover de volta,
 * apaga do histórico o movimento por engano e o retorno, então o funil e a
 * linha do tempo ficam como se nada tivesse acontecido.
 */
export async function undoMoveApplication(input: UndoMoveInput): Promise<ActionResult> {
  const parsed = undoMoveSchema.safeParse(input);
  if (!parsed.success) return failure("Não foi possível desfazer: dados inválidos.");
  const { id, movedTo, movedAt, previousStage, previousPosition, previousStageChangedAt } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ stage: previousStage, position: previousPosition, stage_changed_at: previousStageChangedAt })
    .eq("id", id)
    .eq("user_id", user.id)
    // Só desfaz se ninguém mudou a etapa de novo nesse meio-tempo.
    .eq("stage", movedTo)
    .select("id")
    .maybeSingle();

  if (error) return failure(friendlyDbError(error, "Não foi possível desfazer. Tente novamente."));
  if (!data) return failure("A candidatura mudou de novo e não dá mais para desfazer. Ajuste a etapa manualmente.");

  // Remove o movimento por engano e o registro de volta criado pelo trigger.
  const [mistake, revert] = await Promise.all([
    supabase
      .from("stage_history")
      .delete()
      .eq("application_id", id)
      .eq("user_id", user.id)
      .eq("from_stage", previousStage)
      .eq("to_stage", movedTo)
      .gte("changed_at", movedAt),
    supabase
      .from("stage_history")
      .delete()
      .eq("application_id", id)
      .eq("user_id", user.id)
      .eq("from_stage", movedTo)
      .eq("to_stage", previousStage)
      .eq("changed_at", previousStageChangedAt),
  ]);
  const cleanupError = mistake.error ?? revert.error;
  if (cleanupError) return failure(friendlyDbError(cleanupError, "A etapa voltou, mas o histórico não foi limpo."));

  revalidateApp();
  return success();
}

export async function duplicateApplication(id: string): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return failure(NOT_FOUND);

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const original = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (original.error) return failure(friendlyDbError(original.error));
  if (!original.data) return failure(NOT_FOUND);

  const source = original.data;
  const suffix = " (cópia)";
  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      company: source.company,
      role_title: source.role_title.slice(0, 160 - suffix.length) + suffix,
      job_type: source.job_type,
      job_url: source.job_url,
      platform: source.platform,
      location: source.location,
      work_model: source.work_model,
      salary_cents: source.salary_cents,
      priority: source.priority,
      notes: source.notes,
      // A cópia começa do zero: sem data de candidatura e na primeira etapa.
      stage: "quero_candidatar",
      applied_at: null,
      position: topPosition(),
    })
    .select("id")
    .single();

  if (error) return failure(friendlyDbError(error, "Não foi possível duplicar a candidatura. Tente novamente."));

  revalidateApp();
  return success({ id: data.id });
}

export async function deleteApplication(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return failure(NOT_FOUND);

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) return failure(friendlyDbError(error, "Não foi possível excluir a candidatura. Tente novamente."));
  if (!data || data.length === 0) return failure(NOT_FOUND);

  revalidateApp();
  return success();
}

/** Dados enxutos para a busca da paleta de comandos. */
export async function searchApplications(): Promise<
  ActionResult<{ id: string; company: string; role_title: string; stage: StageKey }[]>
> {
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role_title, stage")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) return failure(friendlyDbError(error, "Não foi possível buscar as candidaturas."));
  return success(data);
}

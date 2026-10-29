"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { topPosition } from "@/features/board/board-state";
import { failure, friendlyDbError, success, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import type { ConcursoStageKey } from "@/lib/concurso-stages";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import {
  concursoFormSchema,
  moveConcursoSchema,
  subjectStatusSchema,
  toConcursoPayload,
  toDateRows,
  toSubjectRows,
  undoMoveConcursoSchema,
  type ConcursoFormValues,
  type MoveConcursoInput,
  type UndoMoveConcursoInput,
} from "./schema";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";
const NOT_FOUND = "Não encontramos esse concurso. Ele pode ter sido excluído.";
const idSchema = z.uuid();

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Grava o cronograma e as matérias do concurso. O cronograma é trocado
 * inteiro; as matérias que já existiam são atualizadas (e guardam o que já
 * foi estudado), as removidas são apagadas e as novas, criadas.
 */
async function saveChildren(supabase: Client, concursoId: string, userId: string, values: ConcursoFormValues) {
  const removedDates = await supabase.from("concurso_dates").delete().eq("concurso_id", concursoId).eq("user_id", userId);
  if (removedDates.error) return removedDates.error;
  const dateRows = toDateRows(concursoId, userId, values.dates);
  if (dateRows.length > 0) {
    const inserted = await supabase.from("concurso_dates").insert(dateRows);
    if (inserted.error) return inserted.error;
  }

  const existing = await supabase.from("concurso_subjects").select("id").eq("concurso_id", concursoId).eq("user_id", userId);
  if (existing.error) return existing.error;
  // Só valem os ids que já são deste concurso; qualquer outro vira matéria nova.
  const existingIds = new Set((existing.data ?? []).map((row) => row.id));
  const subjectRows = toSubjectRows(concursoId, userId, values.subjects, existingIds, () => crypto.randomUUID());
  const keep = subjectRows.map((row) => row.id!).filter((id) => existingIds.has(id));

  const removeSubjects = supabase.from("concurso_subjects").delete().eq("concurso_id", concursoId).eq("user_id", userId);
  const removed = keep.length > 0 ? await removeSubjects.not("id", "in", `(${keep.join(",")})`) : await removeSubjects;
  if (removed.error) return removed.error;
  if (subjectRows.length > 0) {
    const saved = await supabase.from("concurso_subjects").upsert(subjectRows, { onConflict: "id" });
    if (saved.error) return saved.error;
  }
  return null;
}

export async function createConcurso(values: ConcursoFormValues): Promise<ActionResult<{ id: string }>> {
  const parsed = concursoFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("concursos")
    .insert({ ...toConcursoPayload(parsed.data), user_id: user.id, position: topPosition() })
    .select("id")
    .single();
  if (error) return failure(friendlyDbError(error, "Não foi possível criar o concurso. Tente novamente."));

  const childError = await saveChildren(supabase, data.id, user.id, parsed.data);
  if (childError) {
    // Sem o cronograma e as matérias, o concurso ficaria pela metade: desfaz.
    await supabase.from("concursos").delete().eq("id", data.id).eq("user_id", user.id);
    return failure(friendlyDbError(childError, "Não foi possível salvar o cronograma e as matérias. Tente novamente."));
  }

  revalidateApp();
  return success({ id: data.id });
}

export async function updateConcurso(id: string, values: ConcursoFormValues): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return failure(NOT_FOUND);
  const parsed = concursoFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const current = await supabase.from("concursos").select("stage").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (current.error) return failure(friendlyDbError(current.error));
  if (!current.data) return failure(NOT_FOUND);

  const payload = toConcursoPayload(parsed.data);
  const stageChanged = payload.stage !== current.data.stage;
  const { data, error } = await supabase
    .from("concursos")
    // Mudou de etapa pelo formulário: vai para o topo da nova coluna.
    .update(stageChanged ? { ...payload, position: topPosition() } : payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return failure(friendlyDbError(error, "Não foi possível salvar as alterações. Tente novamente."));
  if (!data) return failure(NOT_FOUND);

  const childError = await saveChildren(supabase, id, user.id, parsed.data);
  if (childError) return failure(friendlyDbError(childError, "O concurso foi salvo, mas o cronograma ou as matérias não."));

  revalidateApp();
  return success({ id: data.id });
}

/**
 * Muda a etapa (e opcionalmente a posição no quadro). O registro no histórico
 * é feito por um trigger no banco, então não depende de quem chamou.
 */
export async function moveConcurso(
  input: MoveConcursoInput,
): Promise<ActionResult<{ id: string; stage: ConcursoStageKey; position: number; stage_changed_at: string }>> {
  const parsed = moveConcursoSchema.safeParse(input);
  if (!parsed.success) return failure("Não foi possível mover: dados inválidos.");

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("concursos")
    .update({ stage: parsed.data.stage, position: parsed.data.position ?? topPosition() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id, stage, position, stage_changed_at")
    .maybeSingle();

  if (error) return failure(friendlyDbError(error, "Não foi possível mover o concurso. Tente novamente."));
  if (!data) return failure(NOT_FOUND);

  revalidateApp();
  return success(data);
}

/**
 * Desfaz uma mudança de etapa feita há pouco: volta etapa, posição e data, e
 * apaga do histórico o movimento por engano e o retorno.
 */
export async function undoMoveConcurso(input: UndoMoveConcursoInput): Promise<ActionResult> {
  const parsed = undoMoveConcursoSchema.safeParse(input);
  if (!parsed.success) return failure("Não foi possível desfazer: dados inválidos.");
  const { id, movedTo, movedAt, previousStage, previousPosition, previousStageChangedAt } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("concursos")
    .update({ stage: previousStage, position: previousPosition, stage_changed_at: previousStageChangedAt })
    .eq("id", id)
    .eq("user_id", user.id)
    // Só desfaz se ninguém mudou a etapa de novo nesse meio-tempo.
    .eq("stage", movedTo)
    .select("id")
    .maybeSingle();

  if (error) return failure(friendlyDbError(error, "Não foi possível desfazer. Tente novamente."));
  if (!data) return failure("O concurso mudou de novo e não dá mais para desfazer. Ajuste a etapa manualmente.");

  const [mistake, revert] = await Promise.all([
    supabase
      .from("concurso_stage_history")
      .delete()
      .eq("concurso_id", id)
      .eq("user_id", user.id)
      .eq("from_stage", previousStage)
      .eq("to_stage", movedTo)
      .gte("changed_at", movedAt),
    supabase
      .from("concurso_stage_history")
      .delete()
      .eq("concurso_id", id)
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

export async function deleteConcurso(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return failure(NOT_FOUND);

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase.from("concursos").delete().eq("id", id).eq("user_id", user.id).select("id");
  if (error) return failure(friendlyDbError(error, "Não foi possível excluir o concurso. Tente novamente."));
  if (!data || data.length === 0) return failure(NOT_FOUND);

  revalidateApp();
  return success();
}

/** Marca uma matéria como não estudada, estudada ou revisada. */
export async function setSubjectStatus(input: { id: string; status: string }): Promise<ActionResult> {
  const parsed = subjectStatusSchema.safeParse(input);
  if (!parsed.success) return failure("Não foi possível atualizar a matéria.");

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("concurso_subjects")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return failure(friendlyDbError(error, "Não foi possível atualizar a matéria."));
  if (!data || data.length === 0) return failure("Essa matéria não existe mais. Atualize a página.");

  revalidateApp();
  return success();
}

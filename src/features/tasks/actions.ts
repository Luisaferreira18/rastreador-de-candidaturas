"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import type { Task } from "@/features/applications/types";
import { failure, friendlyDbError, success, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { taskFormSchema, type TaskFormValues } from "./schema";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";
const TASK_NOT_FOUND = "Não encontramos essa tarefa. Atualize a página.";
const idSchema = z.uuid();

export async function createTask(applicationId: string, values: TaskFormValues): Promise<ActionResult<Task>> {
  if (!idSchema.safeParse(applicationId).success) return failure("Candidatura inválida.");
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) return failure("Revise o próximo passo.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      title: parsed.data.title,
      due_date: parsed.data.dueDate || null,
    })
    .select("*")
    .single();

  if (error) return failure(friendlyDbError(error, "Não foi possível adicionar o próximo passo."));

  revalidateApp();
  return success(data);
}

export async function setTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(taskId).success) return failure(TASK_NOT_FOUND);

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ done })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return failure(friendlyDbError(error, "Não foi possível atualizar a tarefa."));
  if (!data || data.length === 0) return failure(TASK_NOT_FOUND);

  revalidateApp();
  return success();
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(taskId).success) return failure(TASK_NOT_FOUND);

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return failure(friendlyDbError(error, "Não foi possível excluir a tarefa."));
  if (!data || data.length === 0) return failure(TASK_NOT_FOUND);

  revalidateApp();
  return success();
}

import "server-only";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { friendlyDbError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { subjectProgress } from "./subjects";
import type { ConcursoDetail, ConcursoSummary, ScheduleDate } from "./types";

/**
 * Leituras dos concursos. Toda função exige login e usa o cliente com a
 * sessão do usuário, então o RLS garante que só os dados dele voltam.
 */

function loadError(error: unknown): Error {
  return new Error(friendlyDbError(error, "Não foi possível carregar seus concursos. Tente atualizar a página."));
}

export async function listConcursoSummaries(): Promise<ConcursoSummary[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const [concursos, dates, subjects, tasks] = await Promise.all([
    supabase.from("concursos").select("*").eq("user_id", user.id).order("position"),
    supabase.from("concurso_dates").select("concurso_id, kind, date, time").eq("user_id", user.id),
    supabase.from("concurso_subjects").select("concurso_id, status, weight, questions").eq("user_id", user.id),
    supabase
      .from("tasks")
      .select("concurso_id, due_date")
      .eq("user_id", user.id)
      .eq("done", false)
      .not("concurso_id", "is", null),
  ]);
  for (const result of [concursos, dates, subjects, tasks]) {
    if (result.error) throw loadError(result.error);
  }

  const datesById = Map.groupBy(dates.data ?? [], (row) => row.concurso_id);
  const subjectsById = Map.groupBy(subjects.data ?? [], (row) => row.concurso_id);
  const pending = new Map<string, { count: number; nextDueDate: string | null }>();
  for (const task of tasks.data ?? []) {
    if (!task.concurso_id) continue;
    const current = pending.get(task.concurso_id) ?? { count: 0, nextDueDate: null };
    current.count += 1;
    if (task.due_date && (!current.nextDueDate || task.due_date < current.nextDueDate)) current.nextDueDate = task.due_date;
    pending.set(task.concurso_id, current);
  }

  return (concursos.data ?? []).map((concurso) => ({
    ...concurso,
    dates: (datesById.get(concurso.id) ?? []).map(({ kind, date, time }): ScheduleDate => ({ kind, date, time })),
    progress: subjectProgress(subjectsById.get(concurso.id) ?? []),
    pendingTasks: pending.get(concurso.id)?.count ?? 0,
    nextDueDate: pending.get(concurso.id)?.nextDueDate ?? null,
  }));
}

export async function getConcursoDetail(id: string): Promise<ConcursoDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const user = await requireUser();
  const supabase = await createClient();

  const [concurso, history, dates, subjects, tasks] = await Promise.all([
    supabase.from("concursos").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("concurso_stage_history")
      .select("*")
      .eq("concurso_id", id)
      .eq("user_id", user.id)
      .order("changed_at", { ascending: true }),
    supabase
      .from("concurso_dates")
      .select("*")
      .eq("concurso_id", id)
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
    supabase
      .from("concurso_subjects")
      .select("*")
      .eq("concurso_id", id)
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("concurso_id", id)
      .eq("user_id", user.id)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  if (concurso.error) throw loadError(concurso.error);
  if (!concurso.data) return null;
  for (const result of [history, dates, subjects, tasks]) {
    if (result.error) throw loadError(result.error);
  }

  return {
    concurso: concurso.data,
    history: history.data ?? [],
    dates: dates.data ?? [],
    subjects: subjects.data ?? [],
    tasks: tasks.data ?? [],
  };
}

/** Tudo dos concursos do usuário para exportar em CSV. */
export async function getConcursoExportData() {
  const user = await requireUser();
  const supabase = await createClient();
  const [concursos, dates, subjects, history, tasks] = await Promise.all([
    supabase.from("concursos").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("concurso_dates").select("*").eq("user_id", user.id),
    supabase.from("concurso_subjects").select("*").eq("user_id", user.id),
    supabase.from("concurso_stage_history").select("*").eq("user_id", user.id).order("changed_at"),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .not("concurso_id", "is", null)
      .order("due_date", { nullsFirst: false }),
  ]);
  for (const result of [concursos, dates, subjects, history, tasks]) {
    if (result.error) throw loadError(result.error);
  }
  return {
    concursos: concursos.data ?? [],
    dates: dates.data ?? [],
    subjects: subjects.data ?? [],
    history: history.data ?? [],
    tasks: tasks.data ?? [],
  };
}

/** Um concurso e o cronograma dele, ou todos, para o arquivo .ics da agenda. */
export async function getConcursoCalendarData(id?: string) {
  if (id !== undefined && !z.uuid().safeParse(id).success) return null;
  const user = await requireUser();
  const supabase = await createClient();

  let concursosQuery = supabase.from("concursos").select("*").eq("user_id", user.id);
  let datesQuery = supabase.from("concurso_dates").select("*").eq("user_id", user.id);
  if (id) {
    concursosQuery = concursosQuery.eq("id", id);
    datesQuery = datesQuery.eq("concurso_id", id);
  }
  const [concursos, dates] = await Promise.all([concursosQuery, datesQuery]);
  if (concursos.error) throw loadError(concursos.error);
  if (dates.error) throw loadError(dates.error);
  if (id && (concursos.data ?? []).length === 0) return null;

  const datesById = Map.groupBy(dates.data ?? [], (item) => item.concurso_id);
  return (concursos.data ?? []).map((concurso) => ({ concurso, dates: datesById.get(concurso.id) ?? [] }));
}

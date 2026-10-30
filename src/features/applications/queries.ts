import "server-only";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { friendlyDbError } from "@/lib/action-result";
import type { AgendaConcurso } from "@/features/concursos/agenda";
import { getConcursoStage } from "@/lib/concurso-stages";
import { todayISO } from "@/lib/format";
import { getStage } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import type {
  Application,
  ApplicationDetail,
  ApplicationSummary,
  StageHistoryEntry,
  Task,
  TaskWithParent,
} from "./types";

/**
 * Leituras do banco (Data Access Layer). Toda função exige login e usa o
 * cliente com a sessão do usuário, então o RLS garante que só os dados dele
 * voltam. O filtro por user_id fica explícito também, por clareza e índice.
 */

function loadError(error: unknown): Error {
  return new Error(friendlyDbError(error, "Não foi possível carregar seus dados. Tente atualizar a página."));
}

export async function listApplicationSummaries(): Promise<ApplicationSummary[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const [applicationsResult, tasksResult] = await Promise.all([
    supabase.from("applications").select("*").eq("user_id", user.id).order("position"),
    supabase
      .from("tasks")
      .select("application_id, due_date")
      .eq("user_id", user.id)
      .eq("done", false)
      .not("application_id", "is", null),
  ]);

  if (applicationsResult.error) throw loadError(applicationsResult.error);
  if (tasksResult.error) throw loadError(tasksResult.error);

  const pendingByApplication = new Map<string, { count: number; nextDueDate: string | null }>();
  for (const task of tasksResult.data) {
    // Tarefas de concursos ficam de fora (application_id vazio).
    if (!task.application_id) continue;
    const current = pendingByApplication.get(task.application_id) ?? { count: 0, nextDueDate: null };
    current.count += 1;
    if (task.due_date && (!current.nextDueDate || task.due_date < current.nextDueDate)) {
      current.nextDueDate = task.due_date;
    }
    pendingByApplication.set(task.application_id, current);
  }

  return applicationsResult.data.map((application) => {
    const pending = pendingByApplication.get(application.id);
    return {
      ...application,
      pendingTasks: pending?.count ?? 0,
      nextDueDate: pending?.nextDueDate ?? null,
    };
  });
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const user = await requireUser();
  const supabase = await createClient();

  const [applicationResult, historyResult, tasksResult] = await Promise.all([
    supabase.from("applications").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("stage_history")
      .select("*")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("changed_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  if (applicationResult.error) throw loadError(applicationResult.error);
  if (!applicationResult.data) return null;
  if (historyResult.error) throw loadError(historyResult.error);
  if (tasksResult.error) throw loadError(tasksResult.error);

  return {
    application: applicationResult.data,
    history: historyResult.data,
    tasks: tasksResult.data,
  };
}

export type DashboardData = {
  applications: Pick<Application, "id" | "stage" | "platform" | "applied_at" | "company" | "role_title">[];
  history: Pick<StageHistoryEntry, "application_id" | "to_stage">[];
  /** Tarefas pendentes com prazo, das candidaturas e dos concursos. */
  tasks: TaskWithParent[];
  /** Concursos com o cronograma de hoje em diante (agenda do painel). */
  concursos: AgendaConcurso[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireUser();
  const supabase = await createClient();

  const [applicationsResult, historyResult, tasksResult, concursosResult, datesResult] = await Promise.all([
    supabase
      .from("applications")
      .select("id, stage, platform, applied_at, company, role_title")
      .eq("user_id", user.id),
    supabase.from("stage_history").select("application_id, to_stage").eq("user_id", user.id),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("done", false)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true }),
    supabase.from("concursos").select("id, organ, role_title, stage").eq("user_id", user.id),
    supabase
      .from("concurso_dates")
      .select("concurso_id, kind, date, time")
      .eq("user_id", user.id)
      .gte("date", todayISO()),
  ]);

  if (applicationsResult.error) throw loadError(applicationsResult.error);
  if (historyResult.error) throw loadError(historyResult.error);
  if (tasksResult.error) throw loadError(tasksResult.error);
  if (concursosResult.error) throw loadError(concursosResult.error);
  if (datesResult.error) throw loadError(datesResult.error);

  const applicationsById = new Map(applicationsResult.data.map((a) => [a.id, a]));
  const concursosById = new Map(concursosResult.data.map((c) => [c.id, c]));
  const tasks: TaskWithParent[] = tasksResult.data.flatMap((task: Task) => {
    const application = task.application_id ? applicationsById.get(task.application_id) : undefined;
    if (application) {
      const parent = { href: `/candidaturas/${application.id}`, name: application.company, dot: getStage(application.stage).dot };
      return [{ ...task, parent }];
    }
    const concurso = task.concurso_id ? concursosById.get(task.concurso_id) : undefined;
    if (concurso) {
      const parent = { href: `/concursos/${concurso.id}`, name: concurso.organ, dot: getConcursoStage(concurso.stage).dot };
      return [{ ...task, parent }];
    }
    return [];
  });

  const datesByConcurso = Map.groupBy(datesResult.data, (item) => item.concurso_id);
  const concursos: AgendaConcurso[] = concursosResult.data.map((concurso) => ({
    ...concurso,
    dates: datesByConcurso.get(concurso.id) ?? [],
  }));

  return { applications: applicationsResult.data, history: historyResult.data, tasks, concursos };
}

/** Tudo do usuário para exportar em CSV. */
export async function getExportData() {
  const user = await requireUser();
  const supabase = await createClient();
  const [applications, history, tasks] = await Promise.all([
    supabase.from("applications").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("stage_history").select("*").eq("user_id", user.id).order("changed_at"),
    supabase.from("tasks").select("*").eq("user_id", user.id).order("due_date", { nullsFirst: false }),
  ]);
  if (applications.error) throw loadError(applications.error);
  if (history.error) throw loadError(history.error);
  if (tasks.error) throw loadError(tasks.error);
  return { applications: applications.data, history: history.data, tasks: tasks.data };
}

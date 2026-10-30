/**
 * Monta o relatório diário a partir de um retrato dos dados. Função pura:
 * o mesmo resultado vira e-mail, mensagem de WhatsApp e prévia no app.
 */

import { concursoDeadlines, type AgendaItem } from "@/features/concursos/agenda";
import { computeDashboardMetrics } from "@/features/dashboard/metrics";
import { groupUpcomingTasks } from "@/features/tasks/upcoming";
import type { DateKind } from "@/lib/concurso-options";
import type { ConcursoStageKey } from "@/lib/concurso-stages";
import { addDaysISO, diffDaysISO, timestampToISODate } from "@/lib/format";
import type { Platform } from "@/lib/options";
import { getStage, isActiveStage, type StageKey } from "@/lib/stages";

/** Os dados necessários para o relatório (vêm do banco por qualquer um dos caminhos). */
export type ReportSnapshot = {
  applications: {
    id: string;
    company: string;
    role_title: string;
    stage: StageKey;
    platform: Platform;
    stage_changed_at: string;
    applied_at: string | null;
    created_at: string;
  }[];
  history: { application_id: string; from_stage: StageKey | null; to_stage: StageKey; changed_at: string }[];
  /** Só tarefas pendentes, de candidaturas ou de concursos. */
  tasks: { application_id: string | null; concurso_id?: string | null; title: string; due_date: string | null }[];
  pendingSuggestions: number;
  /** Vagas sugeridas nas últimas 24 horas: as 5 de nota mais alta e o total. */
  newLeads: ReportLead[];
  newLeadsCount: number;
  concursos: { id: string; organ: string; role_title: string; stage: ConcursoStageKey }[];
  /** Datas do cronograma de ontem em diante (o filtro fino é feito aqui). */
  concursoDates: { concurso_id: string; kind: DateKind; date: string; time: string | null }[];
  /** Concursos sugeridos nas últimas 24 horas: os 5 de nota mais alta e o total. */
  newConcursoLeads: ReportConcursoLead[];
  newConcursoLeadsCount: number;
};

export type ReportLead = { company: string; title: string; url: string; score: number };

/** Concurso sugerido. `url` é a página de inscrição (ou o edital, quando não há). */
export type ReportConcursoLead = { organ: string; role: string | null; url: string; score: number };

/** `company` é a empresa da candidatura ou o órgão do concurso. */
export type ReportTask = { title: string; company: string; dueDate: string };
export type ReportChange = { company: string; roleTitle: string; from: StageKey | null; to: StageKey; at: string };
export type ReportStale = { company: string; stage: StageKey; days: number };

export type DailyReport = {
  today: string;
  headline: string;
  overdue: ReportTask[];
  dueToday: ReportTask[];
  dueSoon: ReportTask[];
  changes: ReportChange[];
  stale: ReportStale[];
  pendingSuggestions: number;
  newLeads: ReportLead[];
  newLeadsCount: number;
  /** Datas dos concursos nos próximos 7 dias (inscrição, boleto, prova...). */
  concursoDeadlines: AgendaItem[];
  newConcursoLeads: ReportConcursoLead[];
  newConcursoLeadsCount: number;
  numbers: { total: number; active: number; sentThisWeek: number; responseRate: number | null };
  isEmpty: boolean;
};

/** Vagas em andamento sem mudança há esse tanto de dias aparecem como "paradas". */
export const STALE_AFTER_DAYS = 14;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function buildDailyReport(snapshot: ReportSnapshot, today: string): DailyReport {
  const byId = new Map(snapshot.applications.map((application) => [application.id, application]));
  const concursosById = new Map(snapshot.concursos.map((concurso) => [concurso.id, concurso]));

  // Prazos (tarefas das candidaturas e dos concursos)
  const parentName = (task: ReportSnapshot["tasks"][number]): string | null => {
    if (task.application_id) return byId.get(task.application_id)?.company ?? null;
    if (task.concurso_id) return concursosById.get(task.concurso_id)?.organ ?? null;
    return null;
  };
  const datedTasks = snapshot.tasks.flatMap((task, index) => {
    const company = parentName(task);
    return company === null ? [] : [{ id: String(index), title: task.title, due_date: task.due_date, done: false, company }];
  });
  const groups = groupUpcomingTasks(datedTasks, today);
  const toReportTask = (task: (typeof datedTasks)[number]): ReportTask => ({
    title: task.title,
    company: task.company,
    dueDate: task.due_date!,
  });

  // O que mudou desde ontem
  const since = addDaysISO(today, -1);
  const changes: ReportChange[] = snapshot.history
    .filter((entry) => byId.has(entry.application_id) && timestampToISODate(entry.changed_at) >= since)
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .map((entry) => {
      const application = byId.get(entry.application_id)!;
      return {
        company: application.company,
        roleTitle: application.role_title,
        from: entry.from_stage,
        to: entry.to_stage,
        at: entry.changed_at,
      };
    });

  // Vagas paradas
  const stale: ReportStale[] = snapshot.applications
    .filter((application) => isActiveStage(application.stage))
    .map((application) => ({
      company: application.company,
      stage: application.stage,
      days: diffDaysISO(timestampToISODate(application.stage_changed_at), today),
    }))
    .filter((item) => item.days >= STALE_AFTER_DAYS)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  // Números
  const metrics = computeDashboardMetrics(
    snapshot.applications,
    snapshot.history.map((entry) => ({ application_id: entry.application_id, to_stage: entry.to_stage })),
  );
  const weekAgo = addDaysISO(today, -6);
  const sentThisWeek = snapshot.applications.filter(
    (application) => application.applied_at && application.applied_at >= weekAgo && application.applied_at <= today,
  ).length;

  // Datas dos concursos na semana
  const datesByConcurso = Map.groupBy(snapshot.concursoDates, (item) => item.concurso_id);
  const concursoItems = concursoDeadlines(
    snapshot.concursos.map((concurso) => ({ ...concurso, dates: datesByConcurso.get(concurso.id) ?? [] })),
    today,
  );

  const overdue = groups.overdue.map(toReportTask);
  const dueToday = groups.today.map(toReportTask);
  const dueSoon = groups.soon.map(toReportTask);

  const headlineParts = [
    dueToday.length > 0 && plural(dueToday.length, "prazo hoje", "prazos hoje"),
    overdue.length > 0 && plural(overdue.length, "atrasado", "atrasados"),
    changes.length > 0 && plural(changes.length, "novidade", "novidades"),
    snapshot.pendingSuggestions > 0 && plural(snapshot.pendingSuggestions, "sugestão para conferir", "sugestões para conferir"),
    snapshot.newLeadsCount > 0 && plural(snapshot.newLeadsCount, "vaga nova para você", "vagas novas para você"),
    concursoItems.length > 0 && plural(concursoItems.length, "data de concurso na semana", "datas de concurso na semana"),
    snapshot.newConcursoLeadsCount > 0 &&
      plural(snapshot.newConcursoLeadsCount, "concurso novo para você", "concursos novos para você"),
  ].filter(Boolean) as string[];

  const isEmpty =
    overdue.length +
      dueToday.length +
      dueSoon.length +
      changes.length +
      stale.length +
      snapshot.pendingSuggestions +
      snapshot.newLeadsCount +
      concursoItems.length +
      snapshot.newConcursoLeadsCount ===
    0;

  return {
    today,
    headline: headlineParts.length > 0 ? headlineParts.join(", ") : "nada urgente hoje",
    overdue,
    dueToday,
    dueSoon,
    changes,
    stale,
    pendingSuggestions: snapshot.pendingSuggestions,
    newLeads: snapshot.newLeads,
    newLeadsCount: snapshot.newLeadsCount,
    concursoDeadlines: concursoItems,
    newConcursoLeads: snapshot.newConcursoLeads,
    newConcursoLeadsCount: snapshot.newConcursoLeadsCount,
    numbers: {
      total: metrics.total,
      active: metrics.active,
      sentThisWeek,
      responseRate: metrics.responseRate,
    },
    isEmpty,
  };
}

/** "Nuvem Pay: Teste online → Entrevista RH" ou "Nuvem Pay adicionada em Candidatura enviada". */
export function describeChange(change: ReportChange): string {
  return change.from
    ? `${change.company}: ${getStage(change.from).label} → ${getStage(change.to).label}`
    : `${change.company} adicionada em ${getStage(change.to).label}`;
}

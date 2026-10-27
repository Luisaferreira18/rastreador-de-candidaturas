/**
 * Monta o relatório diário a partir de um retrato dos dados. Função pura:
 * o mesmo resultado vira e-mail, mensagem de WhatsApp e prévia no app.
 */

import { computeDashboardMetrics } from "@/features/dashboard/metrics";
import { groupUpcomingTasks } from "@/features/tasks/upcoming";
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
  /** Só tarefas pendentes. */
  tasks: { application_id: string; title: string; due_date: string | null }[];
  pendingSuggestions: number;
  /** Vagas sugeridas nas últimas 24 horas: as 5 de nota mais alta e o total. */
  newLeads: ReportLead[];
  newLeadsCount: number;
};

export type ReportLead = { company: string; title: string; url: string; score: number };

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

  // Prazos
  const datedTasks = snapshot.tasks
    .filter((task) => byId.has(task.application_id))
    .map((task, index) => ({
      id: String(index),
      title: task.title,
      due_date: task.due_date,
      done: false,
      company: byId.get(task.application_id)!.company,
    }));
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

  const overdue = groups.overdue.map(toReportTask);
  const dueToday = groups.today.map(toReportTask);
  const dueSoon = groups.soon.map(toReportTask);

  const headlineParts = [
    dueToday.length > 0 && plural(dueToday.length, "prazo hoje", "prazos hoje"),
    overdue.length > 0 && plural(overdue.length, "atrasado", "atrasados"),
    changes.length > 0 && plural(changes.length, "novidade", "novidades"),
    snapshot.pendingSuggestions > 0 && plural(snapshot.pendingSuggestions, "sugestão para conferir", "sugestões para conferir"),
    snapshot.newLeadsCount > 0 && plural(snapshot.newLeadsCount, "vaga nova para você", "vagas novas para você"),
  ].filter(Boolean) as string[];

  const isEmpty =
    overdue.length +
      dueToday.length +
      dueSoon.length +
      changes.length +
      stale.length +
      snapshot.pendingSuggestions +
      snapshot.newLeadsCount ===
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

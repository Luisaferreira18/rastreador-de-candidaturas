/**
 * A agenda dos concursos: as datas do cronograma que pedem atenção (inscrição,
 * isenção e boleto vencendo nos próximos dias) e as próximas datas. A mesma
 * conta serve ao painel, ao resumo diário e ao WhatsApp. Funções puras, com a
 * data de hoje recebida de fora.
 */

import { getConcursoStage, concursoStageIndex, type ConcursoStageKey } from "@/lib/concurso-stages";
import { dateKindLabel, type DateKind } from "@/lib/concurso-options";
import { addDaysISO, formatDate, formatRelativeDay } from "@/lib/format";
import { daysUntil, formatTime, isUrgent, sortSchedule } from "./schedule";
import type { ScheduleDate } from "./types";

export type AgendaConcurso = {
  id: string;
  organ: string;
  role_title: string;
  stage: ConcursoStageKey;
  dates: readonly ScheduleDate[];
};

export type AgendaItem = {
  concursoId: string;
  organ: string;
  roleTitle: string;
  kind: DateKind;
  date: string;
  time: string | null;
  /** Dias até a data (0 = hoje). */
  days: number;
  /** Inscrição, isenção ou boleto vencendo dentro do prazo de alerta. */
  urgent: boolean;
};

/**
 * Etapa a partir da qual a data já foi cumprida: quem fez a inscrição não
 * precisa mais do aviso de fim das inscrições, e quem pagou não precisa do
 * aviso do boleto.
 */
const DONE_FROM: Partial<Record<DateKind, ConcursoStageKey>> = {
  inscricao_inicio: "inscricao_feita",
  isencao: "inscricao_feita",
  inscricao_fim: "inscricao_feita",
  boleto: "taxa_paga",
};

/** A data ainda importa para um concurso nessa etapa? Concursos encerrados não têm agenda. */
export function isDatePending(kind: DateKind, stage: ConcursoStageKey): boolean {
  if (getConcursoStage(stage).kind === "final") return false;
  const doneFrom = DONE_FROM[kind];
  return !doneFrom || concursoStageIndex(stage) < concursoStageIndex(doneFrom);
}

export type ConcursoAgenda = {
  /** Inscrição, isenção e boleto vencendo nos próximos `alertDays` dias. */
  alerts: AgendaItem[];
  /** As outras datas até `horizonDays` dias (sem repetir os alertas). */
  upcoming: AgendaItem[];
};

export function concursoAgenda(
  concursos: readonly AgendaConcurso[],
  today: string,
  { alertDays = 7, horizonDays = 30 }: { alertDays?: number; horizonDays?: number } = {},
): ConcursoAgenda {
  const limit = addDaysISO(today, horizonDays);
  const items: AgendaItem[] = [];
  for (const concurso of concursos) {
    for (const item of sortSchedule(concurso.dates)) {
      if (item.date < today || item.date > limit || !isDatePending(item.kind, concurso.stage)) continue;
      items.push({
        concursoId: concurso.id,
        organ: concurso.organ,
        roleTitle: concurso.role_title,
        kind: item.kind,
        date: item.date,
        time: formatTime(item.time),
        days: daysUntil(item.date, today),
        urgent: isUrgent(item, today, alertDays),
      });
    }
  }
  const sorted = items.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.organ.localeCompare(b.organ),
  );
  return { alerts: sorted.filter((item) => item.urgent), upcoming: sorted.filter((item) => !item.urgent) };
}

/** As datas dos próximos `days` dias, alertas e demais juntos, por data (resumo diário). */
export function concursoDeadlines(concursos: readonly AgendaConcurso[], today: string, days = 7): AgendaItem[] {
  const { alerts, upcoming } = concursoAgenda(concursos, today, { alertDays: days, horizonDays: days });
  return [...alerts, ...upcoming].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

/** "TRT-8 · Analista Judiciário" */
export function agendaConcursoName(item: Pick<AgendaItem, "organ" | "roleTitle">): string {
  return `${item.organ} · ${item.roleTitle}`;
}

/** "amanhã, 30/10/2026 às 08:00" */
export function agendaWhen(item: Pick<AgendaItem, "date" | "time">, today: string): string {
  return `${formatRelativeDay(item.date, today)}, ${formatDate(item.date)}${item.time ? ` às ${item.time}` : ""}`;
}

/** "• Fim das inscrições · TRT-8 · Analista Judiciário: amanhã, 30/10/2026" */
export function agendaLine(item: AgendaItem, today: string): string {
  return `• ${dateKindLabel(item.kind)} · ${agendaConcursoName(item)}: ${agendaWhen(item, today)}`;
}

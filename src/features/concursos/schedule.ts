/**
 * Cálculos do cronograma de um concurso: a próxima data, quantos dias faltam
 * para a prova e se as inscrições estão abertas. Funções puras, com a data de
 * hoje recebida de fora, para dar o mesmo resultado no servidor e nos testes.
 */

import { DATE_KINDS, type DateKind } from "@/lib/concurso-options";
import { diffDaysISO, formatDate, formatDayCount } from "@/lib/format";
import type { ScheduleDate } from "./types";

const KIND_ORDER = new Map(DATE_KINDS.map((kind, index) => [kind.value, index]));

/** Por data, depois hora, depois a ordem natural dos tipos (inscrição antes da prova). */
export function sortSchedule<T extends ScheduleDate>(dates: readonly T[]): T[] {
  return [...dates].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0),
  );
}

/** Dias de hoje até a data (0 = hoje, negativo = já passou). */
export function daysUntil(date: string, today: string): number {
  return diffDaysISO(today, date);
}

/** A próxima data (de hoje em diante), opcionalmente só de alguns tipos. */
export function nextDate<T extends ScheduleDate>(
  dates: readonly T[],
  today: string,
  kinds?: readonly DateKind[],
): T | null {
  return sortSchedule(dates).find((item) => item.date >= today && (!kinds || kinds.includes(item.kind))) ?? null;
}

export type ExamCountdown =
  | { status: "futura"; days: number; date: string; time: string | null }
  | { status: "hoje"; days: 0; date: string; time: string | null }
  | { status: "passou"; days: number; date: string; time: string | null };

/**
 * Contagem até a prova. Com várias provas (objetiva e discursiva em dias
 * diferentes), vale a próxima; se todas já passaram, a última.
 */
export function examCountdown(dates: readonly ScheduleDate[], today: string): ExamCountdown | null {
  const exams = sortSchedule(dates.filter((item) => item.kind === "prova"));
  if (exams.length === 0) return null;
  const upcoming = exams.find((item) => item.date >= today);
  if (upcoming) {
    const days = daysUntil(upcoming.date, today);
    return days === 0
      ? { status: "hoje", days: 0, date: upcoming.date, time: upcoming.time }
      : { status: "futura", days, date: upcoming.date, time: upcoming.time };
  }
  const last = exams[exams.length - 1];
  return { status: "passou", days: -daysUntil(last.date, today), date: last.date, time: last.time };
}

export type RegistrationStatus =
  | { status: "em-breve"; opensIn: number; start: string; end: string | null }
  | { status: "abertas"; closesIn: number | null; end: string | null }
  | { status: "encerradas"; end: string }
  | { status: "sem-data" };

/** Situação das inscrições a partir do início e do fim informados. */
export function registrationStatus(dates: readonly ScheduleDate[], today: string): RegistrationStatus {
  const sorted = sortSchedule(dates);
  const start = sorted.find((item) => item.kind === "inscricao_inicio")?.date ?? null;
  // Com mais de um fim (prorrogação), vale o último.
  const ends = sorted.filter((item) => item.kind === "inscricao_fim");
  const end = ends.length > 0 ? ends[ends.length - 1].date : null;

  if (end && end < today) return { status: "encerradas", end };
  if (start && start > today) return { status: "em-breve", opensIn: daysUntil(start, today), start, end };
  if (end) return { status: "abertas", closesIn: daysUntil(end, today), end };
  if (start) return { status: "abertas", closesIn: null, end: null };
  return { status: "sem-data" };
}

/** Datas que pedem atenção nos próximos `days` dias (inscrição e boleto vencendo). */
export function isUrgent(item: ScheduleDate, today: string, days = 7): boolean {
  const left = daysUntil(item.date, today);
  return (item.kind === "inscricao_fim" || item.kind === "boleto" || item.kind === "isencao") && left >= 0 && left <= days;
}

/** "08:00:00" (como vem do banco) → "08:00"; "08:30" → "08:30". */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})/.exec(time);
  return match ? `${match[1]}:${match[2]}` : null;
}

/** "Prova em 23 dias", "Prova amanhã", "Prova hoje", "Prova foi há 3 dias". */
export function examCountdownLabel(countdown: ExamCountdown): string {
  if (countdown.status === "hoje") return "Prova hoje";
  if (countdown.status === "passou") return countdown.days === 0 ? "Prova hoje" : `Prova foi há ${formatDayCount(countdown.days)}`;
  return countdown.days === 1 ? "Prova amanhã" : `Prova em ${formatDayCount(countdown.days)}`;
}

/** "Inscrições até 05/11 (em 4 dias)", "Inscrições abrem em 3 dias", "Inscrições encerradas". */
export function registrationLabel(status: RegistrationStatus): string | null {
  switch (status.status) {
    case "em-breve":
      return status.opensIn === 1 ? "Inscrições abrem amanhã" : `Inscrições abrem em ${formatDayCount(status.opensIn)}`;
    case "abertas":
      if (status.closesIn === null || !status.end) return "Inscrições abertas";
      if (status.closesIn === 0) return "Inscrições terminam hoje";
      if (status.closesIn === 1) return "Inscrições terminam amanhã";
      return `Inscrições até ${formatDate(status.end).slice(0, 5)} (em ${formatDayCount(status.closesIn)})`;
    case "encerradas":
      return "Inscrições encerradas";
    case "sem-data":
      return null;
  }
}

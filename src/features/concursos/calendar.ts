/**
 * Cronograma em arquivo .ics (iCalendar, RFC 5545), para importar no Google
 * Agenda, no calendário do celular ou no Outlook. Datas sem hora viram eventos
 * de dia inteiro; com hora, eventos no horário de Brasília. Função pura.
 */

import { dateKindLabel, type DateKind } from "@/lib/concurso-options";
import { addDaysISO } from "@/lib/format";
import { formatTime } from "./schedule";
import type { Concurso, ConcursoDate } from "./types";

export type CalendarConcurso = {
  concurso: Pick<Concurso, "id" | "organ" | "role_title" | "notice_url" | "registration_url">;
  dates: Pick<ConcursoDate, "id" | "kind" | "date" | "time" | "note">[];
};

const TZID = "America/Sao_Paulo";
const CRLF = "\r\n";

/** Datas que ganham lembrete: o que vence e a prova. */
const REMINDER_KINDS: readonly DateKind[] = ["inscricao_fim", "isencao", "boleto", "prova"];

/** Escapa texto: barra invertida, ponto e vírgula, vírgula e quebras de linha. */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Quebra linhas com mais de 75 bytes (a continuação começa com um espaço), sem cortar acentos. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // A primeira linha tem 75 bytes; as seguintes, 74 mais o espaço do início.
    if (size + bytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const compactDate = (iso: string) => iso.replace(/-/g, "");

/** 2026-10-29T15:04:05.123Z → 20261029T150405Z */
function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Duração dos eventos com hora: a prova costuma levar a tarde toda. */
function durationOf(kind: DateKind): string {
  return kind === "prova" ? "PT4H" : "PT1H";
}

export function buildConcursoCalendar(
  items: readonly CalendarConcurso[],
  { appUrl, now = new Date(), name = "Concursos" }: { appUrl: string; now?: Date; name?: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rastreador de candidaturas//Concursos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    `X-WR-TIMEZONE:${TZID}`,
    // Brasília não tem horário de verão desde 2019: um fuso fixo basta.
    "BEGIN:VTIMEZONE",
    `TZID:${TZID}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  const stamp = utcStamp(now);

  for (const { concurso, dates } of items) {
    const link = `${appUrl}/concursos/${concurso.id}`;
    for (const item of dates) {
      const time = formatTime(item.time);
      const description = [
        item.note,
        concurso.registration_url && `Inscrição (só no site oficial): ${concurso.registration_url}`,
        concurso.notice_url && `Edital: ${concurso.notice_url}`,
        `No Rastreador: ${link}`,
      ]
        .filter(Boolean)
        .join("\n");

      lines.push(
        "BEGIN:VEVENT",
        `UID:concurso-data-${item.id}@rastreador-de-candidaturas`,
        `DTSTAMP:${stamp}`,
        ...(time
          ? [`DTSTART;TZID=${TZID}:${compactDate(item.date)}T${time.replace(":", "")}00`, `DURATION:${durationOf(item.kind)}`]
          : [
              `DTSTART;VALUE=DATE:${compactDate(item.date)}`,
              `DTEND;VALUE=DATE:${compactDate(addDaysISO(item.date, 1))}`,
              "TRANSP:TRANSPARENT",
            ]),
        `SUMMARY:${escapeIcsText(`${dateKindLabel(item.kind)}: ${concurso.organ} (${concurso.role_title})`)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `URL:${link}`,
      );
      if (REMINDER_KINDS.includes(item.kind)) {
        lines.push(
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcsText(`${dateKindLabel(item.kind)} amanhã: ${concurso.organ}`)}`,
          // Dia inteiro: às 9h da véspera. Com hora: 24 horas antes.
          `TRIGGER:${time ? "-P1D" : "-PT15H"}`,
          "END:VALARM",
        );
      }
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** "concurso-trt-8-analista-judiciario.ics" */
export function calendarFileName(concurso?: Pick<Concurso, "organ" | "role_title">): string {
  if (!concurso) return "concursos.ics";
  const slug = `${concurso.organ} ${concurso.role_title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
  return `concurso-${slug || "cronograma"}.ics`;
}

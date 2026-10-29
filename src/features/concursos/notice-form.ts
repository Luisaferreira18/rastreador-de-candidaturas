/**
 * Do que o leitor de edital encontrou para o formulário do concurso. A pessoa
 * confere e completa tudo antes de salvar.
 */

import type { EducationLevel } from "@/lib/concurso-options";
import { centsToInput, formatCurrency, formatDate } from "@/lib/format";
import type { NoticeReading } from "./notice-parser";
import { emptyConcursoFormValues, type ConcursoFormValues } from "./schema";

/** Resposta de POST /api/concursos/edital. */
export type NoticeReadResponse =
  | {
      status: "ok";
      reading: NoticeReading;
      /** Escolaridade de cada cargo encontrado (mesma ordem de `reading.roles`). */
      educationByRole: (EducationLevel | null)[];
      source: { url: string | null; isPdf: boolean; chars: number };
    }
  | { status: "erro"; message: string };

export function readingToFormValues(
  reading: NoticeReading,
  options: { role: string | null; education: EducationLevel | null; sourceUrl: string | null; today: string },
): ConcursoFormValues {
  const hasRegistration = reading.dates.some((item) => item.kind === "inscricao_inicio" || item.kind === "inscricao_fim");
  const notes = [
    reading.feeCents !== null && `Taxa de inscrição: ${formatCurrency(reading.feeCents)}.`,
    reading.salaries.length > 1 &&
      `Remunerações citadas no edital: ${reading.salaries.map((cents) => formatCurrency(cents)).join(", ")}.`,
    `Preenchido pelo leitor de edital em ${formatDate(options.today)}. Confira no edital oficial.`,
  ].filter(Boolean);

  return {
    ...emptyConcursoFormValues,
    organ: reading.organ ?? "",
    roleTitle: (options.role ?? "").slice(0, 160),
    examBoard: reading.examBoard ?? "",
    sphere: reading.sphere ?? emptyConcursoFormValues.sphere,
    education: options.education ?? reading.education ?? emptyConcursoFormValues.education,
    salary: reading.salaries.length > 0 ? centsToInput(reading.salaries[0]) : "",
    vacancies: reading.vacancies === null ? "" : String(reading.vacancies),
    reserveList: reading.reserveList,
    city: reading.city ?? "",
    state: reading.state ?? "",
    noticeUrl: options.sourceUrl ?? reading.noticeUrl ?? "",
    registrationUrl: reading.registrationUrl ?? "",
    // Edital lido = edital publicado.
    stage: hasRegistration ? "edital_publicado" : emptyConcursoFormValues.stage,
    notes: notes.join("\n"),
    dates: reading.dates.slice(0, 30).map((item) => ({
      kind: item.kind,
      date: item.date,
      time: item.time ?? "",
      note: item.note ?? "",
    })),
  };
}

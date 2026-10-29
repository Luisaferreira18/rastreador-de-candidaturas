/**
 * Progresso das matérias. Cada matéria vale o peso informado; sem peso, o
 * número de questões; sem os dois, 1. Assim uma matéria com 40 questões conta
 * mais que uma com 10, como na prova.
 */

import { SUBJECT_STATUS_VALUES, type SubjectStatus } from "@/lib/concurso-options";

type SubjectLike = { status: SubjectStatus; weight: number | null; questions: number | null };

export type SubjectProgress = {
  total: number;
  /** Estudadas ou revisadas. */
  studied: number;
  reviewed: number;
  /** De 0 a 100, pelo peso de cada matéria. */
  studiedPercent: number;
  reviewedPercent: number;
};

export function subjectWeight(subject: Pick<SubjectLike, "weight" | "questions">): number {
  if (subject.weight !== null && subject.weight > 0) return Number(subject.weight);
  if (subject.questions !== null && subject.questions > 0) return subject.questions;
  return 1;
}

export function subjectProgress(subjects: readonly SubjectLike[]): SubjectProgress {
  let totalWeight = 0;
  let studiedWeight = 0;
  let reviewedWeight = 0;
  let studied = 0;
  let reviewed = 0;
  for (const subject of subjects) {
    const weight = subjectWeight(subject);
    totalWeight += weight;
    if (subject.status !== "nao_estudado") {
      studied += 1;
      studiedWeight += weight;
    }
    if (subject.status === "revisado") {
      reviewed += 1;
      reviewedWeight += weight;
    }
  }
  const percent = (part: number) => (totalWeight === 0 ? 0 : Math.round((part / totalWeight) * 100));
  return {
    total: subjects.length,
    studied,
    reviewed,
    studiedPercent: percent(studiedWeight),
    reviewedPercent: percent(reviewedWeight),
  };
}

/** Próximo status ao clicar: não estudado → estudado → revisado → não estudado. */
export function nextSubjectStatus(status: SubjectStatus): SubjectStatus {
  const index = SUBJECT_STATUS_VALUES.indexOf(status);
  return SUBJECT_STATUS_VALUES[(index + 1) % SUBJECT_STATUS_VALUES.length];
}

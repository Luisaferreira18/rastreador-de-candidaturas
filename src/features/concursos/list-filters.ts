/**
 * Filtros e ordenação da lista de concursos. Funções puras, lidas e gravadas
 * na URL (?q=&etapa=&esfera=&banca=&escolaridade=&local=&ordem=&dir=), para que
 * uma busca possa ser favoritada ou compartilhada.
 */

import { normalizeText } from "@/features/applications/list-filters";
import { EDUCATION_VALUES, SPHERE_VALUES, type EducationLevel, type Sphere } from "@/lib/concurso-options";
import { CONCURSO_STAGE_KEYS, concursoStageIndex, type ConcursoStageKey } from "@/lib/concurso-stages";
import { PRIORITY_WEIGHT } from "@/lib/options";
import { examCountdown, registrationStatus } from "./schedule";
import type { ConcursoSummary } from "./types";

export const CONCURSO_SORT_KEYS = ["orgao", "etapa", "prova", "inscricao", "salario", "prioridade", "atualizado"] as const;
export type ConcursoSortKey = (typeof CONCURSO_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export type ConcursoFilters = {
  q: string;
  stage: ConcursoStageKey | null;
  sphere: Sphere | null;
  examBoard: string | null;
  education: EducationLevel | null;
  /** "Belo Horizonte/MG" ou só "MG". */
  place: string | null;
  sort: ConcursoSortKey;
  direction: SortDirection;
};

export const DEFAULT_CONCURSO_FILTERS: ConcursoFilters = {
  q: "",
  stage: null,
  sphere: null,
  examBoard: null,
  education: null,
  place: null,
  sort: "atualizado",
  direction: "desc",
};

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseConcursoFilters(params: URLSearchParams): ConcursoFilters {
  return {
    q: params.get("q") ?? "",
    stage: pick(params.get("etapa"), CONCURSO_STAGE_KEYS),
    sphere: pick(params.get("esfera"), SPHERE_VALUES),
    examBoard: params.get("banca")?.trim() || null,
    education: pick(params.get("escolaridade"), EDUCATION_VALUES),
    place: params.get("local")?.trim() || null,
    sort: pick(params.get("ordem"), CONCURSO_SORT_KEYS) ?? DEFAULT_CONCURSO_FILTERS.sort,
    direction:
      params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : DEFAULT_CONCURSO_FILTERS.direction,
  };
}

export function serializeConcursoFilters(filters: ConcursoFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q);
  if (filters.stage) params.set("etapa", filters.stage);
  if (filters.sphere) params.set("esfera", filters.sphere);
  if (filters.examBoard) params.set("banca", filters.examBoard);
  if (filters.education) params.set("escolaridade", filters.education);
  if (filters.place) params.set("local", filters.place);
  if (filters.sort !== DEFAULT_CONCURSO_FILTERS.sort || filters.direction !== DEFAULT_CONCURSO_FILTERS.direction) {
    params.set("ordem", filters.sort);
    params.set("dir", filters.direction);
  }
  return params.toString();
}

export function hasActiveConcursoFilters(filters: ConcursoFilters): boolean {
  return Boolean(
    filters.q.trim() || filters.stage || filters.sphere || filters.examBoard || filters.education || filters.place,
  );
}

/** "Belo Horizonte/MG", "MG" ou null: como o local aparece no filtro. */
export function placeKey(concurso: Pick<ConcursoSummary, "city" | "state">): string | null {
  if (concurso.city && concurso.state) return `${concurso.city}/${concurso.state}`;
  return concurso.city ?? concurso.state ?? null;
}

/** Bancas e locais que aparecem nos concursos da pessoa (opções dos filtros). */
export function filterOptions(concursos: readonly ConcursoSummary[]) {
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  const unique = (values: (string | null)[]) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort(collator.compare);
  return {
    examBoards: unique(concursos.map((concurso) => concurso.exam_board)),
    places: unique(concursos.flatMap((concurso) => [placeKey(concurso), concurso.state])),
  };
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Data da próxima prova (ou "9999" sem prova), para ordenar. */
function examKey(concurso: ConcursoSummary, today: string): string {
  const countdown = examCountdown(concurso.dates, today);
  return countdown && countdown.status !== "passou" ? countdown.date : "9999-12-31";
}

function registrationKey(concurso: ConcursoSummary, today: string): string {
  const status = registrationStatus(concurso.dates, today);
  return status.status === "abertas" && status.end ? status.end : "9999-12-31";
}

function compare(a: ConcursoSummary, b: ConcursoSummary, sort: ConcursoSortKey, today: string): number {
  switch (sort) {
    case "orgao":
      return collator.compare(a.organ, b.organ) || collator.compare(a.role_title, b.role_title);
    case "etapa":
      return concursoStageIndex(a.stage) - concursoStageIndex(b.stage);
    case "prova":
      return examKey(a, today).localeCompare(examKey(b, today));
    case "inscricao":
      return registrationKey(a, today).localeCompare(registrationKey(b, today));
    case "salario":
      return (a.salary_cents ?? -1) - (b.salary_cents ?? -1);
    case "prioridade":
      // "Crescente" = da mais alta para a mais baixa.
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    case "atualizado":
      return a.updated_at.localeCompare(b.updated_at);
  }
}

export function filterAndSortConcursos(
  concursos: readonly ConcursoSummary[],
  filters: ConcursoFilters,
  today: string,
): ConcursoSummary[] {
  const terms = normalizeText(filters.q).split(/\s+/).filter(Boolean);

  const filtered = concursos.filter((concurso) => {
    if (filters.stage && concurso.stage !== filters.stage) return false;
    if (filters.sphere && concurso.sphere !== filters.sphere) return false;
    if (filters.examBoard && normalizeText(concurso.exam_board ?? "") !== normalizeText(filters.examBoard)) return false;
    if (filters.education && concurso.education !== filters.education) return false;
    if (filters.place && placeKey(concurso) !== filters.place && concurso.state !== filters.place) return false;
    if (terms.length === 0) return true;
    const haystack = normalizeText(
      [
        concurso.organ,
        concurso.role_title,
        concurso.exam_board ?? "",
        concurso.area ?? "",
        concurso.city ?? "",
        concurso.notes ?? "",
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });

  const direction = filters.direction === "asc" ? 1 : -1;
  return filtered.sort(
    (a, b) => compare(a, b, filters.sort, today) * direction || collator.compare(a.organ, b.organ),
  );
}

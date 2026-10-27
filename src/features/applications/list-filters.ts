/**
 * Filtros e ordenação da visão em lista. Funções puras, lidas e gravadas na
 * URL (?q=&etapa=&tipo=&plataforma=&modelo=&prioridade=&ordem=&dir=) para que uma
 * busca possa ser favoritada ou compartilhada.
 */

import {
  JOB_TYPE_VALUES,
  PLATFORM_VALUES,
  PRIORITY_VALUES,
  PRIORITY_WEIGHT,
  WORK_MODEL_VALUES,
  type JobType,
  type Platform,
  type Priority,
  type WorkModel,
} from "@/lib/options";
import { STAGE_KEYS, stageIndex, type StageKey } from "@/lib/stages";
import type { ApplicationSummary } from "./types";

export const SORT_KEYS = ["empresa", "etapa", "prioridade", "remuneracao", "candidatura", "atualizada"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

export type ListFilters = {
  q: string;
  stage: StageKey | null;
  jobType: JobType | null;
  platform: Platform | null;
  workModel: WorkModel | null;
  priority: Priority | null;
  sort: SortKey;
  direction: SortDirection;
};

export const DEFAULT_FILTERS: ListFilters = {
  q: "",
  stage: null,
  jobType: null,
  platform: null,
  workModel: null,
  priority: null,
  sort: "atualizada",
  direction: "desc",
};

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseListFilters(params: URLSearchParams): ListFilters {
  return {
    q: params.get("q") ?? "",
    stage: pick(params.get("etapa"), STAGE_KEYS),
    jobType: pick(params.get("tipo"), JOB_TYPE_VALUES),
    platform: pick(params.get("plataforma"), PLATFORM_VALUES),
    workModel: pick(params.get("modelo"), WORK_MODEL_VALUES),
    priority: pick(params.get("prioridade"), PRIORITY_VALUES),
    sort: pick(params.get("ordem"), SORT_KEYS) ?? DEFAULT_FILTERS.sort,
    direction: params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : DEFAULT_FILTERS.direction,
  };
}

export function serializeListFilters(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q);
  if (filters.stage) params.set("etapa", filters.stage);
  if (filters.jobType) params.set("tipo", filters.jobType);
  if (filters.platform) params.set("plataforma", filters.platform);
  if (filters.workModel) params.set("modelo", filters.workModel);
  if (filters.priority) params.set("prioridade", filters.priority);
  if (filters.sort !== DEFAULT_FILTERS.sort || filters.direction !== DEFAULT_FILTERS.direction) {
    params.set("ordem", filters.sort);
    params.set("dir", filters.direction);
  }
  return params.toString();
}

export function hasActiveFilters(filters: ListFilters): boolean {
  return Boolean(
    filters.q.trim() || filters.stage || filters.jobType || filters.platform || filters.workModel || filters.priority,
  );
}

/** Minúsculas e sem acentos: "Saúde" encontra "saude". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function compare(a: ApplicationSummary, b: ApplicationSummary, sort: SortKey): number {
  switch (sort) {
    case "empresa":
      return collator.compare(a.company, b.company) || collator.compare(a.role_title, b.role_title);
    case "etapa":
      return stageIndex(a.stage) - stageIndex(b.stage);
    case "prioridade":
      // "Crescente" = da mais alta para a mais baixa.
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    case "remuneracao":
      return (a.salary_cents ?? -1) - (b.salary_cents ?? -1);
    case "candidatura":
      return (a.applied_at ?? "").localeCompare(b.applied_at ?? "");
    case "atualizada":
      return a.updated_at.localeCompare(b.updated_at);
  }
}

export function filterAndSortApplications(
  applications: readonly ApplicationSummary[],
  filters: ListFilters,
): ApplicationSummary[] {
  const terms = normalizeText(filters.q).split(/\s+/).filter(Boolean);

  const filtered = applications.filter((application) => {
    if (filters.stage && application.stage !== filters.stage) return false;
    if (filters.jobType && application.job_type !== filters.jobType) return false;
    if (filters.platform && application.platform !== filters.platform) return false;
    if (filters.workModel && application.work_model !== filters.workModel) return false;
    if (filters.priority && application.priority !== filters.priority) return false;
    if (terms.length === 0) return true;
    const haystack = normalizeText(
      [application.company, application.role_title, application.location ?? "", application.notes ?? ""].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });

  const direction = filters.direction === "asc" ? 1 : -1;
  return filtered.sort((a, b) => compare(a, b, filters.sort) * direction || collator.compare(a.company, b.company));
}

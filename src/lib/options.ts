/** Opções fixas usadas nos formulários, filtros e no banco (restrições CHECK). */

export const PLATFORMS = [
  { value: "gupy", label: "Gupy" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "site_empresa", label: "Site da empresa" },
  { value: "indicacao", label: "Indicação" },
  { value: "outra", label: "Outra" },
] as const;

export const JOB_TYPES = [
  { value: "estagio", label: "Estágio" },
  { value: "trainee", label: "Trainee" },
  { value: "clt", label: "CLT" },
  { value: "pj", label: "PJ" },
  { value: "temporario", label: "Temporário" },
  { value: "freela", label: "Freela" },
] as const;

export const WORK_MODELS = [
  { value: "presencial", label: "Presencial" },
  { value: "hibrido", label: "Híbrido" },
  { value: "remoto", label: "Remoto" },
] as const;

export const PRIORITIES = [
  { value: "alta", label: "Alta", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  { value: "media", label: "Média", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { value: "baixa", label: "Baixa", dot: "bg-slate-400", text: "text-muted-foreground" },
] as const;

export type Platform = (typeof PLATFORMS)[number]["value"];
export type JobType = (typeof JOB_TYPES)[number]["value"];
export type WorkModel = (typeof WORK_MODELS)[number]["value"];
export type Priority = (typeof PRIORITIES)[number]["value"];

export const PLATFORM_VALUES = PLATFORMS.map((p) => p.value) as [Platform, ...Platform[]];
export const JOB_TYPE_VALUES = JOB_TYPES.map((t) => t.value) as [JobType, ...JobType[]];
export const WORK_MODEL_VALUES = WORK_MODELS.map((m) => m.value) as [WorkModel, ...WorkModel[]];
export const PRIORITY_VALUES = PRIORITIES.map((p) => p.value) as [Priority, ...Priority[]];

/** Peso para ordenar por prioridade (alta primeiro). */
export const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

export function platformLabel(value: Platform): string {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

export function jobTypeLabel(value: JobType): string {
  return JOB_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function workModelLabel(value: WorkModel): string {
  return WORK_MODELS.find((m) => m.value === value)?.label ?? value;
}

export function priorityOption(value: Priority) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[1];
}

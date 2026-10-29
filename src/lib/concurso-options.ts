/** Opções fixas dos concursos, usadas nos formulários, filtros e no banco (restrições CHECK). */

export const SPHERES = [
  { value: "federal", label: "Federal" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
] as const;

/** Da menor para a maior: a ordem serve para comparar escolaridades. */
export const EDUCATION_LEVELS = [
  { value: "fundamental", label: "Ensino fundamental", short: "Fundamental" },
  { value: "medio", label: "Ensino médio", short: "Médio" },
  { value: "tecnico", label: "Técnico", short: "Técnico" },
  { value: "superior", label: "Ensino superior", short: "Superior" },
] as const;

/** Datas do cronograma, na ordem em que costumam acontecer. */
export const DATE_KINDS = [
  { value: "inscricao_inicio", label: "Início das inscrições", short: "Inscrições abrem" },
  { value: "isencao", label: "Pedido de isenção", short: "Isenção" },
  { value: "inscricao_fim", label: "Fim das inscrições", short: "Inscrições fecham" },
  { value: "boleto", label: "Vencimento do boleto", short: "Boleto" },
  { value: "prova", label: "Prova", short: "Prova" },
  { value: "gabarito", label: "Gabarito", short: "Gabarito" },
  { value: "recurso", label: "Recurso", short: "Recurso" },
  { value: "resultado", label: "Resultado", short: "Resultado" },
  { value: "validade", label: "Validade do concurso", short: "Validade" },
] as const;

export const SUBJECT_STATUSES = [
  { value: "nao_estudado", label: "Não estudado" },
  { value: "estudado", label: "Estudado" },
  { value: "revisado", label: "Revisado" },
] as const;

export type Sphere = (typeof SPHERES)[number]["value"];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number]["value"];
export type DateKind = (typeof DATE_KINDS)[number]["value"];
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number]["value"];

export const SPHERE_VALUES = SPHERES.map((item) => item.value) as [Sphere, ...Sphere[]];
export const EDUCATION_VALUES = EDUCATION_LEVELS.map((item) => item.value) as [EducationLevel, ...EducationLevel[]];
export const DATE_KIND_VALUES = DATE_KINDS.map((item) => item.value) as [DateKind, ...DateKind[]];
export const SUBJECT_STATUS_VALUES = SUBJECT_STATUSES.map((item) => item.value) as [SubjectStatus, ...SubjectStatus[]];

export function sphereLabel(value: Sphere): string {
  return SPHERES.find((item) => item.value === value)?.label ?? value;
}

export function educationLabel(value: EducationLevel, short = false): string {
  const level = EDUCATION_LEVELS.find((item) => item.value === value);
  return level ? (short ? level.short : level.label) : value;
}

export function dateKindLabel(value: DateKind, short = false): string {
  const kind = DATE_KINDS.find((item) => item.value === value);
  return kind ? (short ? kind.short : kind.label) : value;
}

export function subjectStatusLabel(value: SubjectStatus): string {
  return SUBJECT_STATUSES.find((item) => item.value === value)?.label ?? value;
}

/** Ordem da escolaridade (0 = fundamental): para comparar o que o concurso pede com o que a pessoa tem. */
export function educationRank(value: EducationLevel): number {
  return EDUCATION_VALUES.indexOf(value);
}

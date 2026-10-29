/**
 * Etapas de um concurso público. Esta lista é a fonte única de verdade:
 * nomes, cores e ordem vêm daqui, e as mesmas chaves estão travadas no banco
 * por uma restrição CHECK. Concurso não tem entrevista nem proposta, por isso
 * as etapas são próprias (as das candidaturas ficam em stages.ts).
 *
 * Os nomes falam da etapa, não da pessoa ("Inscrição feita", e não "Inscrita").
 */

import type { StageInfo } from "./stages";

export const CONCURSO_STAGE_KEYS = [
  "acompanhando",
  "edital_publicado",
  "inscricao_feita",
  "taxa_paga",
  "prova_marcada",
  "prova_feita",
  "resultado",
  "aprovacao",
  "nomeacao",
  "sem_aprovacao",
  "desisti",
] as const;

export type ConcursoStageKey = (typeof CONCURSO_STAGE_KEYS)[number];

export const CONCURSO_STAGES: readonly StageInfo<ConcursoStageKey>[] = [
  {
    key: "acompanhando",
    label: "Acompanhando",
    shortLabel: "Acompanhando",
    kind: "inicial",
    hex: "#64748b",
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-300",
    column: "bg-slate-500/[0.04] dark:bg-slate-500/[0.07]",
  },
  {
    key: "edital_publicado",
    label: "Edital publicado",
    shortLabel: "Edital publicado",
    kind: "inicial",
    hex: "#0ea5e9",
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    column: "bg-sky-500/[0.04] dark:bg-sky-500/[0.07]",
  },
  {
    key: "inscricao_feita",
    label: "Inscrição feita",
    shortLabel: "Inscrição feita",
    kind: "processo",
    hex: "#3b82f6",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:text-blue-300",
    column: "bg-blue-500/[0.04] dark:bg-blue-500/[0.07]",
  },
  {
    key: "taxa_paga",
    label: "Taxa paga",
    shortLabel: "Taxa paga",
    kind: "processo",
    hex: "#6366f1",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
    column: "bg-indigo-500/[0.04] dark:bg-indigo-500/[0.07]",
  },
  {
    key: "prova_marcada",
    label: "Prova marcada",
    shortLabel: "Prova marcada",
    kind: "processo",
    hex: "#8b5cf6",
    dot: "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
    column: "bg-violet-500/[0.04] dark:bg-violet-500/[0.07]",
  },
  {
    key: "prova_feita",
    label: "Prova feita",
    shortLabel: "Prova feita",
    kind: "processo",
    hex: "#f59e0b",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
    column: "bg-amber-500/[0.04] dark:bg-amber-500/[0.07]",
  },
  {
    key: "resultado",
    label: "Resultado",
    shortLabel: "Resultado",
    kind: "processo",
    hex: "#f97316",
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300",
    column: "bg-orange-500/[0.04] dark:bg-orange-500/[0.07]",
  },
  {
    key: "aprovacao",
    label: "Aprovação",
    shortLabel: "Aprovação",
    kind: "processo",
    hex: "#14b8a6",
    dot: "bg-teal-500",
    badge: "bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-300",
    column: "bg-teal-500/[0.04] dark:bg-teal-500/[0.07]",
  },
  {
    key: "nomeacao",
    label: "Nomeação",
    shortLabel: "Nomeação",
    kind: "final",
    hex: "#22c55e",
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-700 ring-green-500/25 dark:text-green-300",
    column: "bg-green-500/[0.04] dark:bg-green-500/[0.07]",
  },
  {
    key: "sem_aprovacao",
    label: "Sem aprovação",
    shortLabel: "Sem aprovação",
    kind: "final",
    hex: "#ef4444",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300",
    column: "bg-red-500/[0.04] dark:bg-red-500/[0.07]",
  },
  {
    key: "desisti",
    label: "Desisti",
    shortLabel: "Desisti",
    kind: "final",
    hex: "#78716c",
    dot: "bg-stone-500",
    badge: "bg-stone-500/10 text-stone-700 ring-stone-500/25 dark:text-stone-300",
    column: "bg-stone-500/[0.04] dark:bg-stone-500/[0.07]",
  },
];

const STAGE_MAP = new Map(CONCURSO_STAGES.map((stage) => [stage.key, stage]));

export function getConcursoStage(key: ConcursoStageKey): StageInfo<ConcursoStageKey> {
  const stage = STAGE_MAP.get(key);
  if (!stage) throw new Error(`Etapa de concurso desconhecida: ${key}`);
  return stage;
}

export function isConcursoStageKey(value: unknown): value is ConcursoStageKey {
  return typeof value === "string" && STAGE_MAP.has(value as ConcursoStageKey);
}

/** Índice da etapa na lista (usado para ordenar por etapa). */
export function concursoStageIndex(key: ConcursoStageKey): number {
  return CONCURSO_STAGE_KEYS.indexOf(key);
}

/** Colunas que começam recolhidas no quadro de concursos. */
export const COLLAPSIBLE_CONCURSO_STAGES: readonly ConcursoStageKey[] = ["nomeacao", "sem_aprovacao", "desisti"];

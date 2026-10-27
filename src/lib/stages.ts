/**
 * Etapas do processo seletivo. Esta lista é a fonte única de verdade:
 * nomes, cores, ordem do funil e tipo de cada etapa vêm daqui.
 * As mesmas chaves estão travadas no banco por uma restrição CHECK.
 */

export const STAGE_KEYS = [
  "quero_candidatar",
  "enviada",
  "teste_online",
  "dinamica_case",
  "entrevista_rh",
  "entrevista_tecnica",
  "proposta",
  "aprovada",
  "reprovada",
  "desisti",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

/** inicial = ainda não se candidatou; processo = em andamento; final = encerrada. */
export type StageKind = "inicial" | "processo" | "final";

export type StageDefinition = {
  key: StageKey;
  label: string;
  shortLabel: string;
  kind: StageKind;
  /**
   * Posição no funil (0 = quero me candidatar, 7 = aprovada).
   * Etapas que encerram sem avançar (reprovada, desisti) não têm posição.
   */
  funnelOrder: number | null;
  /** Cor em hexadecimal, usada nos gráficos. */
  hex: string;
  /** Classes do Tailwind (escritas por extenso para o Tailwind encontrá-las). */
  dot: string;
  badge: string;
  column: string;
};

export const STAGES: readonly StageDefinition[] = [
  {
    key: "quero_candidatar",
    label: "Quero me candidatar",
    shortLabel: "Quero me candidatar",
    kind: "inicial",
    funnelOrder: 0,
    hex: "#64748b",
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-300",
    column: "bg-slate-500/[0.04] dark:bg-slate-500/[0.07]",
  },
  {
    key: "enviada",
    label: "Candidatura enviada",
    shortLabel: "Enviada",
    kind: "processo",
    funnelOrder: 1,
    hex: "#3b82f6",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:text-blue-300",
    column: "bg-blue-500/[0.04] dark:bg-blue-500/[0.07]",
  },
  {
    key: "teste_online",
    label: "Teste online",
    shortLabel: "Teste online",
    kind: "processo",
    funnelOrder: 2,
    hex: "#06b6d4",
    dot: "bg-cyan-500",
    badge: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
    column: "bg-cyan-500/[0.04] dark:bg-cyan-500/[0.07]",
  },
  {
    key: "dinamica_case",
    label: "Dinâmica ou case",
    shortLabel: "Dinâmica/case",
    kind: "processo",
    funnelOrder: 3,
    hex: "#8b5cf6",
    dot: "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
    column: "bg-violet-500/[0.04] dark:bg-violet-500/[0.07]",
  },
  {
    key: "entrevista_rh",
    label: "Entrevista RH",
    shortLabel: "Entrevista RH",
    kind: "processo",
    funnelOrder: 4,
    hex: "#f59e0b",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
    column: "bg-amber-500/[0.04] dark:bg-amber-500/[0.07]",
  },
  {
    key: "entrevista_tecnica",
    label: "Entrevista técnica",
    shortLabel: "Entrevista técnica",
    kind: "processo",
    funnelOrder: 5,
    hex: "#f97316",
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300",
    column: "bg-orange-500/[0.04] dark:bg-orange-500/[0.07]",
  },
  {
    key: "proposta",
    label: "Proposta",
    shortLabel: "Proposta",
    kind: "processo",
    funnelOrder: 6,
    hex: "#14b8a6",
    dot: "bg-teal-500",
    badge: "bg-teal-500/10 text-teal-700 ring-teal-500/25 dark:text-teal-300",
    column: "bg-teal-500/[0.04] dark:bg-teal-500/[0.07]",
  },
  {
    key: "aprovada",
    label: "Aprovada",
    shortLabel: "Aprovada",
    kind: "final",
    funnelOrder: 7,
    hex: "#22c55e",
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-700 ring-green-500/25 dark:text-green-300",
    column: "bg-green-500/[0.04] dark:bg-green-500/[0.07]",
  },
  {
    key: "reprovada",
    label: "Reprovada",
    shortLabel: "Reprovada",
    kind: "final",
    funnelOrder: null,
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
    funnelOrder: null,
    hex: "#78716c",
    dot: "bg-stone-500",
    badge: "bg-stone-500/10 text-stone-700 ring-stone-500/25 dark:text-stone-300",
    column: "bg-stone-500/[0.04] dark:bg-stone-500/[0.07]",
  },
];

const STAGE_MAP = new Map(STAGES.map((stage) => [stage.key, stage]));

export function getStage(key: StageKey): StageDefinition {
  const stage = STAGE_MAP.get(key);
  if (!stage) throw new Error(`Etapa desconhecida: ${key}`);
  return stage;
}

export function isStageKey(value: unknown): value is StageKey {
  return typeof value === "string" && STAGE_MAP.has(value as StageKey);
}

/** Índice da etapa na lista (usado para ordenar por etapa). */
export function stageIndex(key: StageKey): number {
  return STAGE_KEYS.indexOf(key);
}

/** Etapas que contam como "em andamento" (de Enviada até Proposta). */
export function isActiveStage(key: StageKey): boolean {
  return getStage(key).kind === "processo";
}

/** Etapas do funil, em ordem, a partir de "Candidatura enviada". */
export const FUNNEL_STAGES: readonly StageDefinition[] = STAGES.filter(
  (stage) => stage.funnelOrder !== null && stage.funnelOrder >= 1,
).sort((a, b) => (a.funnelOrder ?? 0) - (b.funnelOrder ?? 0));

/** Colunas que começam recolhidas no Kanban. */
export const COLLAPSIBLE_STAGES: readonly StageKey[] = ["aprovada", "reprovada", "desisti"];

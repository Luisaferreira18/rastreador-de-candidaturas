/**
 * Cálculo das métricas do painel. Funções puras: recebem as candidaturas e o
 * histórico de etapas e devolvem números prontos para exibir.
 *
 * Regra central: "etapa mais avançada alcançada". Uma vaga que foi da
 * Entrevista RH para Reprovada continua contando como tendo chegado à
 * Entrevista RH. Uma vaga que pulou o Teste online e foi direto para a
 * entrevista conta como tendo passado pelo teste (passou por ele ou além).
 */

import { addDaysISO } from "@/lib/format";
import { PLATFORMS, type Platform } from "@/lib/options";
import { FUNNEL_STAGES, STAGES, getStage, isActiveStage, type StageKey } from "@/lib/stages";

export type MetricsApplication = {
  id: string;
  stage: StageKey;
  platform: Platform;
  applied_at: string | null;
};

export type MetricsHistoryEntry = {
  application_id: string;
  to_stage: StageKey;
};

export type FunnelStep = { stage: StageKey; label: string; hex: string; count: number };

export type ConversionStep = {
  from: StageKey;
  to: StageKey;
  fromLabel: string;
  toLabel: string;
  reached: number;
  advanced: number;
  /** De 0 a 1, ou `null` quando nenhuma vaga chegou à etapa de origem. */
  rate: number | null;
};

export type DashboardMetrics = {
  total: number;
  wishlist: number;
  active: number;
  sent: number;
  responded: number;
  responseRate: number | null;
  approved: number;
  approvalRate: number | null;
  closed: number;
  funnel: FunnelStep[];
  conversion: ConversionStep[];
  byPlatform: { platform: Platform; label: string; count: number }[];
  byStage: { stage: StageKey; label: string; hex: string; count: number }[];
};

const SENT_ORDER = 1;
const FIRST_RESPONSE_ORDER = 2;

/**
 * Etapa mais avançada do funil que a candidatura já alcançou (0 a 7).
 * Reprovada e Desisti não avançam o funil. Mas ser reprovada, ou ter data de
 * candidatura, significa que a candidatura foi enviada (ordem mínima 1).
 */
export function maxFunnelOrder(application: MetricsApplication, visited: readonly StageKey[]): number {
  let max = 0;
  for (const stage of [application.stage, ...visited]) {
    const order = getStage(stage).funnelOrder;
    if (order !== null && order > max) max = order;
  }
  const wasRejected = application.stage === "reprovada" || visited.includes("reprovada");
  if (max < SENT_ORDER && (application.applied_at || wasRejected)) max = SENT_ORDER;
  return max;
}

export type WeeklyPoint = { weekStart: string; label: string; count: number };

/** Segunda-feira da semana de uma data "AAAA-MM-DD". */
export function startOfWeekISO(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDaysISO(iso, -((day + 6) % 7));
}

/** Candidaturas enviadas por semana (segunda a domingo), nas últimas `weeks` semanas. */
export function weeklyApplications(
  applications: readonly Pick<MetricsApplication, "applied_at">[],
  today: string,
  weeks = 8,
): WeeklyPoint[] {
  const currentWeek = startOfWeekISO(today);
  const points: WeeklyPoint[] = Array.from({ length: weeks }, (_, index) => {
    const weekStart = addDaysISO(currentWeek, -7 * (weeks - 1 - index));
    const [, month, day] = weekStart.split("-");
    return { weekStart, label: `${day}/${month}`, count: 0 };
  });
  const byWeek = new Map(points.map((point) => [point.weekStart, point]));
  for (const application of applications) {
    if (!application.applied_at || application.applied_at > today) continue;
    const point = byWeek.get(startOfWeekISO(application.applied_at));
    if (point) point.count += 1;
  }
  return points;
}

export function computeDashboardMetrics(
  applications: readonly MetricsApplication[],
  history: readonly MetricsHistoryEntry[],
): DashboardMetrics {
  const visitedByApplication = new Map<string, StageKey[]>();
  for (const entry of history) {
    const list = visitedByApplication.get(entry.application_id) ?? [];
    list.push(entry.to_stage);
    visitedByApplication.set(entry.application_id, list);
  }

  const reachedOrders = applications.map((application) => {
    const visited = visitedByApplication.get(application.id) ?? [];
    return {
      application,
      order: maxFunnelOrder(application, visited),
      rejected: application.stage === "reprovada" || visited.includes("reprovada"),
    };
  });

  const countReached = (order: number) => reachedOrders.filter((item) => item.order >= order).length;

  const sent = countReached(SENT_ORDER);
  // Teve resposta = avançou além de "enviada" ou recebeu um "não".
  const responded = reachedOrders.filter(
    (item) => item.order >= FIRST_RESPONSE_ORDER || (item.order >= SENT_ORDER && item.rejected),
  ).length;
  const approvedOrder = getStage("aprovada").funnelOrder!;
  const approved = countReached(approvedOrder);

  const funnel: FunnelStep[] = FUNNEL_STAGES.map((stage) => ({
    stage: stage.key,
    label: stage.label,
    hex: stage.hex,
    count: countReached(stage.funnelOrder!),
  }));

  const conversion: ConversionStep[] = funnel.slice(0, -1).map((step, index) => {
    const nextStep = funnel[index + 1];
    return {
      from: step.stage,
      to: nextStep.stage,
      fromLabel: step.label,
      toLabel: nextStep.label,
      reached: step.count,
      advanced: nextStep.count,
      rate: step.count > 0 ? nextStep.count / step.count : null,
    };
  });

  const byPlatform = PLATFORMS.map((platform) => ({
    platform: platform.value,
    label: platform.label,
    count: applications.filter((application) => application.platform === platform.value).length,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const byStage = STAGES.map((stage) => ({
    stage: stage.key,
    label: stage.label,
    hex: stage.hex,
    count: applications.filter((application) => application.stage === stage.key).length,
  }));

  return {
    total: applications.length,
    wishlist: applications.filter((application) => application.stage === "quero_candidatar").length,
    active: applications.filter((application) => isActiveStage(application.stage)).length,
    sent,
    responded,
    responseRate: sent > 0 ? responded / sent : null,
    approved,
    approvalRate: sent > 0 ? approved / sent : null,
    closed: applications.filter((application) => getStage(application.stage).kind === "final").length,
    funnel,
    conversion,
    byPlatform,
    byStage,
  };
}

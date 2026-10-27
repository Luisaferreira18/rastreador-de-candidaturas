/**
 * Decide o que fazer com uma sugestão: achar a candidatura certa (ou criar
 * uma nova), escolher a nova etapa sem nunca andar para trás e montar a
 * tarefa. Funções puras; quem grava no banco é a Server Action.
 */

import { timestampToISODate } from "@/lib/format";
import type { Platform } from "@/lib/options";
import { getStage, type StageKey } from "@/lib/stages";
import { normalize } from "./parser";
import type { InboxKind } from "./types";

export type PlanApplication = {
  id: string;
  company: string;
  role_title: string;
  stage: StageKey;
  applied_at: string | null;
  updated_at: string;
};

export type PlanItem = {
  kind: InboxKind;
  suggested_stage: StageKey | null;
  company: string | null;
  role_title: string | null;
  platform: Platform | null;
  task_title: string | null;
  due_date: string | null;
  received_at: string;
};

/** Escolhas feitas na tela (todas opcionais). */
export type PlanOverrides = {
  /** Id de uma candidatura existente, ou "nova" para criar uma. */
  applicationId?: string | "nova";
  stage?: StageKey | null;
  company?: string;
  roleTitle?: string;
  taskTitle?: string | null;
  dueDate?: string | null;
};

export type PlanTask = { title: string; dueDate: string | null } | null;

export type InboxPlan =
  | {
      action: "criar";
      company: string;
      roleTitle: string;
      stage: StageKey;
      platform: Platform;
      appliedAt: string | null;
      task: PlanTask;
      summary: string;
    }
  | {
      action: "atualizar";
      applicationId: string;
      company: string;
      stage: StageKey | null;
      setAppliedAt: string | null;
      task: PlanTask;
      summary: string;
    }
  | { action: "nada"; reason: string };

const LEGAL_SUFFIXES = /\b(ltda|s\/?a|sa|me|eireli|epp|inc|corp|group|grupo|brasil|brazil)\b/g;

/** "Banco Aurora S.A." → "bancoaurora" (para comparar nomes de empresa). */
export function companyKey(name: string): string {
  return normalize(name).replace(/\./g, "").replace(LEGAL_SUFFIXES, "").replace(/[^a-z0-9]/g, "");
}

/** Acha a candidatura da mensagem pelo nome da empresa (e, se houver empate, pelo cargo). */
export function matchApplication(
  company: string | null,
  roleTitle: string | null,
  applications: readonly PlanApplication[],
): PlanApplication | null {
  if (!company) return null;
  const key = companyKey(company);
  if (key.length < 3) return null;

  const candidates = applications.filter((application) => {
    const other = companyKey(application.company);
    if (other === key) return true;
    return Math.min(other.length, key.length) >= 4 && (other.includes(key) || key.includes(other));
  });
  if (candidates.length === 0) return null;

  const role = roleTitle ? normalize(roleTitle) : null;
  const score = (application: PlanApplication) =>
    (companyKey(application.company) === key ? 4 : 0) +
    (getStage(application.stage).kind !== "final" ? 2 : 0) +
    (role && normalize(application.role_title).includes(role) ? 1 : 0);

  return [...candidates].sort((a, b) => score(b) - score(a) || b.updated_at.localeCompare(a.updated_at))[0];
}

/**
 * Nova etapa, ou null se não deve mudar. Nunca anda para trás (um e-mail de
 * confirmação atrasado não tira a vaga da entrevista) e não mexe em vagas já
 * encerradas. Reprovação vale de qualquer etapa em andamento.
 */
export function decideStage(current: StageKey, target: StageKey | null): StageKey | null {
  if (!target || target === current) return null;
  if (getStage(current).kind === "final") return null;
  if (target === "reprovada" || target === "desisti") return target;
  const from = getStage(current).funnelOrder ?? 0;
  const to = getStage(target).funnelOrder ?? 0;
  return to > from ? target : null;
}

function buildTask(item: PlanItem, overrides: PlanOverrides): PlanTask {
  const title = overrides.taskTitle !== undefined ? overrides.taskTitle : item.task_title;
  if (!title?.trim()) return null;
  const dueDate = overrides.dueDate !== undefined ? overrides.dueDate : item.due_date;
  return { title: title.trim().slice(0, 200), dueDate: dueDate || null };
}

export function planInboxItem(
  item: PlanItem,
  applications: readonly PlanApplication[],
  overrides: PlanOverrides = {},
): InboxPlan {
  const receivedOn = timestampToISODate(item.received_at);
  const task = buildTask(item, overrides);
  const target = overrides.stage !== undefined ? overrides.stage : item.suggested_stage;

  const existing =
    overrides.applicationId === "nova"
      ? null
      : overrides.applicationId
        ? (applications.find((application) => application.id === overrides.applicationId) ?? null)
        : matchApplication(overrides.company ?? item.company, overrides.roleTitle ?? item.role_title, applications);

  if (existing) {
    const stage = decideStage(existing.stage, target ?? null);
    const reachedSent =
      (stage && ((getStage(stage).funnelOrder ?? 0) >= 1 || stage === "reprovada")) || item.kind === "confirmacao";
    const setAppliedAt = !existing.applied_at && reachedSent ? receivedOn : null;

    if (!stage && !setAppliedAt && !task) {
      return {
        action: "nada",
        reason: target
          ? `${existing.company} já está em ${getStage(existing.stage).label}.`
          : `Nada a mudar em ${existing.company}.`,
      };
    }
    const summary = stage
      ? `${existing.company} → ${getStage(stage).label}`
      : task
        ? `${existing.company}: novo próximo passo`
        : `${existing.company}: data da candidatura registrada`;
    return { action: "atualizar", applicationId: existing.id, company: existing.company, stage, setAppliedAt, task, summary };
  }

  const company = (overrides.company ?? item.company)?.trim();
  if (!company) return { action: "nada", reason: "Não deu para saber a empresa. Escolha a candidatura ou informe a empresa." };

  const stage = target ?? "enviada";
  const sent = (getStage(stage).funnelOrder ?? 0) >= 1 || stage === "reprovada";
  return {
    action: "criar",
    company: company.slice(0, 120),
    roleTitle: ((overrides.roleTitle ?? item.role_title)?.trim() || "Cargo a confirmar").slice(0, 160),
    stage,
    platform: item.platform ?? "outra",
    appliedAt: sent ? receivedOn : null,
    task,
    summary: `${company} adicionada em ${getStage(stage).label}`,
  };
}

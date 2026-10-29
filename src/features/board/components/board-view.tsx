"use client";

import { moveApplication, undoMoveApplication } from "@/features/applications/actions";
import type { ApplicationSummary } from "@/features/applications/types";
import { COLLAPSIBLE_STAGES, STAGES, type StageKey } from "@/lib/stages";
import { ApplicationCard } from "./application-card";
import { KanbanBoard } from "./kanban-board";
import type { KanbanConfig } from "./kanban-types";

const APPLICATIONS_BOARD: KanbanConfig<StageKey, ApplicationSummary> = {
  id: "quadro-kanban",
  stages: STAGES,
  collapsible: COLLAPSIBLE_STAGES,
  storageKey: "rastreador:colunas-recolhidas",
  texts: {
    items: "candidaturas",
    dropHere: "Arraste uma candidatura para cá",
    emptyStage: "Nenhuma candidatura nesta etapa.",
    newItem: "Nova candidatura",
    dragInstructions:
      "Para mover uma candidatura, pressione espaço para pegar, use as setas para escolher a coluna e a posição e espaço de novo para soltar. Esc cancela.",
  },
  newHref: (stage) => `/candidaturas/nova?etapa=${stage}`,
  nameOf: (card) => card.company,
  renderCard: (card, options) => <ApplicationCard card={card} {...options} />,
  move: moveApplication,
  undo: undoMoveApplication,
};

/** Quadro das candidaturas. */
export function BoardView({ applications, today }: { applications: ApplicationSummary[]; today: string }) {
  return <KanbanBoard cards={applications} today={today} config={APPLICATIONS_BOARD} />;
}

"use client";

import { KanbanBoard } from "@/features/board/components/kanban-board";
import type { KanbanConfig } from "@/features/board/components/kanban-types";
import { COLLAPSIBLE_CONCURSO_STAGES, CONCURSO_STAGES, type ConcursoStageKey } from "@/lib/concurso-stages";
import { moveConcurso, undoMoveConcurso } from "../actions";
import type { ConcursoSummary } from "../types";
import { ConcursoCard } from "./concurso-card";

const CONCURSOS_BOARD: KanbanConfig<ConcursoStageKey, ConcursoSummary> = {
  id: "quadro-concursos",
  stages: CONCURSO_STAGES,
  collapsible: COLLAPSIBLE_CONCURSO_STAGES,
  storageKey: "rastreador:colunas-recolhidas-concursos",
  texts: {
    items: "concursos",
    dropHere: "Arraste um concurso para cá",
    emptyStage: "Nenhum concurso nesta etapa.",
    newItem: "Novo concurso",
    dragInstructions:
      "Para mover um concurso, pressione espaço para pegar, use as setas para escolher a coluna e a posição e espaço de novo para soltar. Esc cancela.",
  },
  newHref: (stage) => `/concursos/novo?etapa=${stage}`,
  nameOf: (card) => card.organ,
  renderCard: (card, options) => <ConcursoCard card={card} {...options} />,
  move: moveConcurso,
  undo: undoMoveConcurso,
};

/** Quadro dos concursos, por etapa. */
export function ConcursoBoardView({ concursos, today }: { concursos: ConcursoSummary[]; today: string }) {
  return <KanbanBoard cards={concursos} today={today} config={CONCURSOS_BOARD} />;
}

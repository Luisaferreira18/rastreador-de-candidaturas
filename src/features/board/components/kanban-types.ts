import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { StageInfo } from "@/lib/stages";
import type { PositionedCard } from "../board-state";

/** Card do quadro: além da posição, a data em que entrou na etapa (para desfazer). */
export type BoardCard<K extends string> = PositionedCard<K> & { stage_changed_at: string };

export type CardRenderOptions<K extends string> = {
  today: string;
  onMove?: (stage: K) => void;
  overlay?: boolean;
  placeholder?: boolean;
};

/** Textos do quadro, que mudam com o que está nele ("uma candidatura", "um concurso"). */
export type BoardTexts = {
  /** "candidaturas" */
  items: string;
  /** "Arraste uma candidatura para cá" */
  dropHere: string;
  /** "Nenhuma candidatura nesta etapa." */
  emptyStage: string;
  /** "Nova candidatura" (o botão + de cada coluna) */
  newItem: string;
  /** Instruções lidas por leitores de tela. */
  dragInstructions: string;
};

/**
 * Tudo o que o quadro precisa saber sobre o que mostra: as etapas, como
 * desenhar o card e como salvar a mudança de etapa (Server Actions).
 */
export type KanbanConfig<K extends string, T extends BoardCard<K>> = {
  /** Id estável do DndContext (o mesmo no servidor e no navegador). */
  id: string;
  stages: readonly StageInfo<K>[];
  /** Colunas que começam recolhidas. */
  collapsible: readonly K[];
  /** Onde guardar, no navegador, as colunas recolhidas. */
  storageKey: string;
  texts: BoardTexts;
  newHref: (stage: K) => string;
  /** Nome curto do card, para avisos e leitores de tela ("Banco Aurora"). */
  nameOf: (card: T) => string;
  renderCard: (card: T, options: CardRenderOptions<K>) => ReactNode;
  move: (input: { id: string; stage: K; position: number }) => Promise<ActionResult<{ stage_changed_at: string }>>;
  undo: (input: {
    id: string;
    movedTo: K;
    movedAt: string;
    previousStage: K;
    previousPosition: number;
    previousStageChangedAt: string;
  }) => Promise<ActionResult>;
};

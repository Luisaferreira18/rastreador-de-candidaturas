"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  findStageOf,
  groupByStage,
  moveCard,
  placeCard,
  positionForIndex,
  setCardPosition,
  topPosition,
  type Columns,
} from "../board-state";
import { markDragEnded } from "./drag-guard";
import { KanbanColumn } from "./kanban-column";
import type { BoardCard, KanbanConfig } from "./kanban-types";
import { MobileStageList } from "./mobile-stage-list";

function readCollapsed<K extends string>(storageKey: string, fallback: readonly K[]): K[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored) as K[];
  } catch {
    // localStorage indisponível (aba anônima, por exemplo): usa o padrão.
  }
  return [...fallback];
}

/**
 * Quadro Kanban: arrastar entre colunas no computador, lista por etapa no
 * celular, desfazer a última mudança e anúncios para leitores de tela. Serve
 * a candidaturas e a concursos; o que muda vem em `config`.
 */
export function KanbanBoard<K extends string, T extends BoardCard<K>>({
  cards,
  today,
  config,
}: {
  cards: T[];
  today: string;
  config: KanbanConfig<K, T>;
}) {
  const stageKeys = useMemo(() => config.stages.map((stage) => stage.key), [config.stages]);
  const labelOf = useCallback(
    (key: K) => config.stages.find((stage) => stage.key === key)?.label ?? key,
    [config.stages],
  );
  const stageFromDroppableId = (id: string): K | null =>
    id.startsWith("column:") ? (id.slice("column:".length) as K) : null;

  const [columns, setColumns] = useState<Columns<T, K>>(() => groupByStage(cards, stageKeys));
  const [source, setSource] = useState(cards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<K[]>([...config.collapsible]);
  const [, startTransition] = useTransition();
  const dragOrigin = useRef<{ columns: Columns<T, K>; stage: K; position: number; stageChangedAt: string } | null>(
    null,
  );

  // Quando o servidor manda dados novos (após salvar), sincroniza, exceto no meio de um arrasto.
  if (source !== cards && activeId === null) {
    setSource(cards);
    setColumns(groupByStage(cards, stageKeys));
  }

  useEffect(() => {
    // Preferência guardada no navegador; lida depois de montar para não divergir do HTML do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed(config.storageKey, config.collapsible));
  }, [config.storageKey, config.collapsible]);

  function toggleCollapsed(stage: K) {
    setCollapsed((current) => {
      const next = current.includes(stage) ? current.filter((key) => key !== stage) : [...current, stage];
      try {
        window.localStorage.setItem(config.storageKey, JSON.stringify(next));
      } catch {
        // Sem localStorage: a preferência vale só nesta visita.
      }
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter abre o card; espaço pega e solta.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const findCard = useCallback(
    (id: string) => {
      const stage = findStageOf(columns, id);
      return stage ? columns[stage].find((card) => card.id === id) : undefined;
    },
    [columns],
  );

  /** Salva no servidor; se falhar, volta o quadro ao estado anterior. */
  const persistMove = useCallback(
    (
      card: T,
      toStage: K,
      position: number,
      previous: { stage: K; position: number; stageChangedAt: string; columns: Columns<T, K> },
    ) => {
      startTransition(async () => {
        const result = await config.move({ id: card.id, stage: toStage, position });
        if (!result.ok) {
          setColumns(previous.columns);
          toast.error(result.error);
          return;
        }
        if (toStage === previous.stage) return;

        toast.success(`${config.nameOf(card)} → ${labelOf(toStage)}`, {
          description: "A mudança foi registrada na linha do tempo.",
          action: {
            label: "Desfazer",
            onClick: () => {
              setColumns((current) => placeCard(current, card.id, previous.stage, previous.position));
              startTransition(async () => {
                const undo = await config.undo({
                  id: card.id,
                  movedTo: toStage,
                  movedAt: result.data.stage_changed_at,
                  previousStage: previous.stage,
                  previousPosition: previous.position,
                  previousStageChangedAt: previous.stageChangedAt,
                });
                if (!undo.ok) toast.error(undo.error);
                else toast.success("Movimento desfeito.");
              });
            },
          },
        });
      });
    },
    [config, labelOf],
  );

  /** "Mover para..." (menu do card e lista do celular): vai para o topo da coluna. */
  const moveToStage = useCallback(
    (cardId: string, toStage: K) => {
      const card = findCard(cardId);
      if (!card || card.stage === toStage) return;
      const position = topPosition();
      const previous = { stage: card.stage, position: card.position, stageChangedAt: card.stage_changed_at, columns };
      setColumns((current) => placeCard(current, cardId, toStage, position));
      persistMove(card, toStage, position, previous);
    },
    [columns, findCard, persistMove],
  );

  function handleDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    const card = findCard(id);
    if (!card) return;
    dragOrigin.current = { columns, stage: card.stage, position: card.position, stageChangedAt: card.stage_changed_at };
    setActiveId(id);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeCardId = String(active.id);
    const overId = String(over.id);
    const fromStage = findStageOf(columns, activeCardId);
    const toStage = stageFromDroppableId(overId) ?? findStageOf(columns, overId);
    if (!fromStage || !toStage || fromStage === toStage) return;

    // Entrou em outra coluna: insere acima ou abaixo do card sob o cursor.
    const overCards = columns[toStage];
    const overIndex = overCards.findIndex((card) => card.id === overId);
    const activeTop = active.rect.current.translated?.top ?? 0;
    const isBelow = overIndex >= 0 && activeTop > over.rect.top + over.rect.height / 2;
    const index = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : overCards.length;
    setColumns((current) => moveCard(current, activeCardId, toStage, index));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    markDragEnded();
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    setActiveId(null);
    if (!origin) return;

    const cardId = String(active.id);
    if (!over) {
      setColumns(origin.columns);
      return;
    }

    let next = columns;
    const stage = findStageOf(next, cardId);
    if (!stage) return;

    // Reordenação dentro da mesma coluna.
    const overId = String(over.id);
    const oldIndex = next[stage].findIndex((card) => card.id === cardId);
    const overIndex = next[stage].findIndex((card) => card.id === overId);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      next = { ...next, [stage]: arrayMove(next[stage], oldIndex, overIndex) };
    }

    const position = positionForIndex(next[stage], cardId);
    const unchanged =
      stage === origin.stage &&
      origin.columns[stage].findIndex((card) => card.id === cardId) ===
        next[stage].findIndex((card) => card.id === cardId);
    if (unchanged) {
      setColumns(origin.columns);
      return;
    }

    next = setCardPosition(next, cardId, position);
    setColumns(next);
    const card = next[stage].find((item) => item.id === cardId)!;
    persistMove(card, stage, position, {
      stage: origin.stage,
      position: origin.position,
      stageChangedAt: origin.stageChangedAt,
      columns: origin.columns,
    });
  }

  function handleDragCancel() {
    markDragEnded();
    if (dragOrigin.current) setColumns(dragOrigin.current.columns);
    dragOrigin.current = null;
    setActiveId(null);
  }

  /** Textos lidos por leitores de tela durante o arrastar (acessibilidade). */
  const nameOfId = (id: string) => {
    const card = findCard(id);
    return card ? config.nameOf(card) : "card";
  };
  const where = (id: string | number | undefined) => {
    if (id === undefined) return "";
    const stage = stageFromDroppableId(String(id));
    return stage ? `na coluna ${labelOf(stage)}` : `perto de ${nameOfId(String(id))}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou ${nameOfId(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOfId(String(active.id))} está ${where(over.id)}.` : `${nameOfId(String(active.id))} fora das colunas.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOfId(String(active.id))} solto ${where(over.id)}.` : "Movimento cancelado.",
    onDragCancel: ({ active }) => `Movimento de ${nameOfId(String(active.id))} cancelado.`,
  };

  const activeCard = activeId ? findCard(activeId) : undefined;

  return (
    <>
      <div className="hidden min-h-0 flex-1 md:flex">
        <DndContext
          id={config.id}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: config.texts.dragInstructions },
          }}
        >
          <div className="scrollbar-thin flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
            {config.stages.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                cards={columns[stage.key]}
                today={today}
                config={config}
                collapsed={collapsed.includes(stage.key)}
                onToggleCollapsed={
                  config.collapsible.includes(stage.key) ? () => toggleCollapsed(stage.key) : undefined
                }
                onMoveCard={moveToStage}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {activeCard ? config.renderCard(activeCard, { today, overlay: true }) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="px-4 pb-6 md:hidden">
        <MobileStageList columns={columns} today={today} config={config} onMoveCard={moveToStage} />
      </div>
    </>
  );
}

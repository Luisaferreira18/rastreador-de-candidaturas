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
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveApplication, undoMoveApplication } from "@/features/applications/actions";
import type { ApplicationSummary } from "@/features/applications/types";
import { COLLAPSIBLE_STAGES, STAGES, getStage, type StageKey } from "@/lib/stages";
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
import { ApplicationCard, markDragEnded } from "./application-card";
import { KanbanColumn } from "./kanban-column";
import { MobileStageList } from "./mobile-stage-list";

type Card = ApplicationSummary;

const COLLAPSED_STORAGE_KEY = "rastreador:colunas-recolhidas";

function readCollapsed(): StageKey[] {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as StageKey[];
  } catch {
    // localStorage indisponível (aba anônima, por exemplo): usa o padrão.
  }
  return [...COLLAPSIBLE_STAGES];
}

function stageFromDroppableId(id: string): StageKey | null {
  return id.startsWith("column:") ? (id.slice("column:".length) as StageKey) : null;
}

/** Textos lidos por leitores de tela durante o arrastar (acessibilidade). */
function buildAnnouncements(getCompany: (id: string) => string): Announcements {
  const where = (id: string | number | undefined) => {
    if (id === undefined) return "";
    const stage = stageFromDroppableId(String(id));
    return stage ? `na coluna ${getStage(stage).label}` : `perto de ${getCompany(String(id))}`;
  };
  return {
    onDragStart: ({ active }) => `Pegou ${getCompany(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over ? `${getCompany(String(active.id))} está ${where(over.id)}.` : `${getCompany(String(active.id))} fora das colunas.`,
    onDragEnd: ({ active, over }) =>
      over ? `${getCompany(String(active.id))} solto ${where(over.id)}.` : "Movimento cancelado.",
    onDragCancel: ({ active }) => `Movimento de ${getCompany(String(active.id))} cancelado.`,
  };
}

export function BoardView({ applications, today }: { applications: Card[]; today: string }) {
  const [columns, setColumns] = useState<Columns<Card>>(() => groupByStage(applications));
  const [source, setSource] = useState(applications);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<StageKey[]>([...COLLAPSIBLE_STAGES]);
  const [, startTransition] = useTransition();
  const dragOrigin = useRef<{
    columns: Columns<Card>;
    stage: StageKey;
    position: number;
    stageChangedAt: string;
  } | null>(null);

  // Quando o servidor manda dados novos (após salvar), sincroniza, exceto no meio de um arrasto.
  if (source !== applications && activeId === null) {
    setSource(applications);
    setColumns(groupByStage(applications));
  }

  useEffect(() => {
    // Preferência guardada no navegador; lida depois de montar para não divergir do HTML do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  function toggleCollapsed(stage: StageKey) {
    setCollapsed((current) => {
      const next = current.includes(stage) ? current.filter((key) => key !== stage) : [...current, stage];
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
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
      card: Card,
      toStage: StageKey,
      position: number,
      previous: { stage: StageKey; position: number; stageChangedAt: string; columns: Columns<Card> },
    ) => {
      startTransition(async () => {
        const result = await moveApplication({ id: card.id, stage: toStage, position });
        if (!result.ok) {
          setColumns(previous.columns);
          toast.error(result.error);
          return;
        }
        if (toStage === previous.stage) return;

        toast.success(`${card.company} → ${getStage(toStage).label}`, {
          description: "A mudança foi registrada na linha do tempo.",
          action: {
            label: "Desfazer",
            onClick: () => {
              setColumns((current) => placeCard(current, card.id, previous.stage, previous.position));
              startTransition(async () => {
                const undo = await undoMoveApplication({
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
    [],
  );

  /** "Mover para..." (menu do card e lista do celular): vai para o topo da coluna. */
  const moveToStage = useCallback(
    (cardId: string, toStage: StageKey) => {
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

  const activeCard = activeId ? findCard(activeId) : undefined;

  return (
    <>
      <div className="hidden min-h-0 flex-1 md:flex">
        <DndContext
          id="quadro-kanban"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{
            announcements: buildAnnouncements((id) => findCard(id)?.company ?? "candidatura"),
            screenReaderInstructions: {
              draggable:
                "Para mover uma candidatura, pressione espaço para pegar, use as setas para escolher a coluna e a posição e espaço de novo para soltar. Esc cancela.",
            },
          }}
        >
          <div className="scrollbar-thin flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                cards={columns[stage.key]}
                today={today}
                collapsed={collapsed.includes(stage.key)}
                onToggleCollapsed={
                  COLLAPSIBLE_STAGES.includes(stage.key) ? () => toggleCollapsed(stage.key) : undefined
                }
                onMoveCard={moveToStage}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {activeCard ? <ApplicationCard card={activeCard} today={today} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="px-4 pb-6 md:hidden">
        <MobileStageList columns={columns} today={today} onMoveCard={moveToStage} />
      </div>
    </>
  );
}

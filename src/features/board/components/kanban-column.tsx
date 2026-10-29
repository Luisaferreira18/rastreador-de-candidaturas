"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronsLeftRight, ChevronsRightLeft, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StageInfo } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { BoardCard, KanbanConfig } from "./kanban-types";

export const columnDroppableId = (stage: string) => `column:${stage}`;

function SortableCard<K extends string, T extends BoardCard<K>>({
  card,
  today,
  config,
  onMove,
}: {
  card: T;
  today: string;
  config: KanbanConfig<K, T>;
  onMove: (stage: K) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", stage: card.stage },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="touch-manipulation outline-none"
      {...attributes}
      {...listeners}
      aria-roledescription="card arrastável"
    >
      {config.renderCard(card, { today, onMove, placeholder: isDragging })}
    </li>
  );
}

export function KanbanColumn<K extends string, T extends BoardCard<K>>({
  stage,
  cards,
  today,
  config,
  collapsed,
  onToggleCollapsed,
  onMoveCard,
}: {
  stage: StageInfo<K>;
  cards: T[];
  today: string;
  config: KanbanConfig<K, T>;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onMoveCard: (cardId: string, stage: K) => void;
}) {
  const { texts } = config;
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(stage.key),
    data: { type: "column", stage: stage.key },
  });

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`${stage.label}: ${cards.length} ${texts.items} (coluna recolhida)`}
        className={cn(
          "flex w-11 shrink-0 flex-col items-center gap-3 rounded-xl border border-transparent py-3 transition-colors",
          stage.column,
          isOver && "border-primary/40 bg-primary/5",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={onToggleCollapsed} aria-label={`Expandir ${stage.label}`}>
              <ChevronsLeftRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expandir coluna</TooltipContent>
        </Tooltip>
        <span aria-hidden className={cn("size-2 rounded-full", stage.dot)} />
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{cards.length}</span>
        <span className="text-sm font-medium [writing-mode:vertical-rl]">{stage.label}</span>
      </section>
    );
  }

  return (
    <section
      aria-label={`${stage.label}: ${cards.length} ${texts.items}`}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border border-transparent transition-colors",
        stage.column,
        isOver && "border-primary/40",
      )}
    >
      <header className="flex h-11 items-center gap-2 px-3">
        <span aria-hidden className={cn("size-2 rounded-full", stage.dot)} />
        <h2 className="truncate text-sm font-medium">{stage.label}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
        <div className="ml-auto flex items-center">
          {onToggleCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={onToggleCollapsed} aria-label={`Recolher ${stage.label}`}>
                  <ChevronsRightLeft />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recolher coluna</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" asChild>
                <Link href={config.newHref(stage.key)} aria-label={`${texts.newItem} em ${stage.label}`}>
                  <Plus />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{texts.newItem} nesta etapa</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-40 flex-1 flex-col gap-2 px-2 pb-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              today={today}
              config={config}
              onMove={(toStage) => onMoveCard(card.id, toStage)}
            />
          ))}
          {cards.length === 0 && (
            <li
              className={cn(
                "flex flex-1 items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground transition-colors",
                isOver && "border-primary/50 text-foreground",
              )}
            >
              {texts.dropHere}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

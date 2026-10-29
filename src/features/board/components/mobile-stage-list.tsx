"use client";

import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Columns } from "../board-state";
import type { BoardCard, KanbanConfig } from "./kanban-types";

/**
 * No celular, o quadro vira uma lista agrupada por etapa. Arrastar não é
 * prático em telas pequenas, então a etapa muda pelo menu "..." de cada card.
 */
export function MobileStageList<K extends string, T extends BoardCard<K>>({
  columns,
  today,
  config,
  onMoveCard,
}: {
  columns: Columns<T, K>;
  today: string;
  config: KanbanConfig<K, T>;
  onMoveCard: (cardId: string, stage: K) => void;
}) {
  return (
    <div className="space-y-2">
      {config.stages.map((stage) => {
        const cards = columns[stage.key];
        return (
          <Collapsible
            key={stage.key}
            defaultOpen={cards.length > 0 && stage.kind !== "final"}
            className={cn("rounded-xl", stage.column)}
          >
            <CollapsibleTrigger className="group flex h-11 w-full items-center gap-2 px-3 text-left">
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
              <span aria-hidden className={cn("size-2 rounded-full", stage.dot)} />
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{cards.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {cards.length === 0 ? (
                <p className="px-4 pb-3 text-xs text-muted-foreground">{config.texts.emptyStage}</p>
              ) : (
                <ul className="grid gap-2 px-2 pb-2">
                  {cards.map((card) => (
                    <li key={card.id}>
                      {config.renderCard(card, { today, onMove: (toStage) => onMoveCard(card.id, toStage) })}
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

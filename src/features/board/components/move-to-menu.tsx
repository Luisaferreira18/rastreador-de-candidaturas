"use client";

import { Check } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { STAGES, type StageKey } from "@/lib/stages";
import { cn } from "@/lib/utils";

/** Itens "Mover para <etapa>" para usar dentro de um DropdownMenu. */
export function MoveToMenuItems({
  current,
  onMove,
}: {
  current: StageKey;
  onMove: (stage: StageKey) => void;
}) {
  return (
    <>
      {STAGES.map((stage) => (
        <DropdownMenuItem
          key={stage.key}
          disabled={stage.key === current}
          onSelect={() => onMove(stage.key)}
          className="gap-2"
        >
          <span aria-hidden className={cn("size-2 rounded-full", stage.dot)} />
          <span className="flex-1">{stage.label}</span>
          {stage.key === current && <Check className="size-3.5" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}

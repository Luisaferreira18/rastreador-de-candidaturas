import { getStage, type StageInfo, type StageKey } from "@/lib/stages";
import { cn } from "@/lib/utils";

export function StageDot({ stage, className }: { stage: StageKey; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", getStage(stage).dot, className)} />;
}

/** Etiqueta colorida da etapa de uma candidatura. */
export function StageBadge({
  stage,
  short = false,
  className,
}: {
  stage: StageKey;
  short?: boolean;
  className?: string;
}) {
  return <StagePill definition={getStage(stage)} short={short} className={className} />;
}

/** Etiqueta colorida de qualquer etapa (candidatura ou concurso). */
export function StagePill({
  definition,
  short = false,
  className,
}: {
  definition: StageInfo;
  short?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        definition.badge,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", definition.dot)} />
      {short ? definition.shortLabel : definition.label}
    </span>
  );
}

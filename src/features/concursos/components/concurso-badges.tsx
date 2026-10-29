import { StagePill } from "@/components/stage-badge";
import { sphereLabel, type Sphere } from "@/lib/concurso-options";
import { getConcursoStage, type ConcursoStageKey } from "@/lib/concurso-stages";
import { cn } from "@/lib/utils";

export function ConcursoStageBadge({
  stage,
  short = false,
  className,
}: {
  stage: ConcursoStageKey;
  short?: boolean;
  className?: string;
}) {
  return <StagePill definition={getConcursoStage(stage)} short={short} className={className} />;
}

/** Etiqueta neutra com a esfera (Federal, Estadual, Municipal). */
export function SphereBadge({ sphere, className }: { sphere: Sphere; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {sphereLabel(sphere)}
    </span>
  );
}

import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FunnelStep } from "../metrics";

/**
 * Funil em barras horizontais. Uma cor só (o comprimento já mostra a
 * quantidade); a bolinha colorida liga cada linha à etapa do quadro.
 * Os valores ficam escritos, então o gráfico também funciona como tabela.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  const sent = steps[0]?.count ?? 0;

  return (
    <div role="table" aria-label="Funil de candidaturas" className="space-y-2.5">
      <div role="row" className="sr-only">
        <span role="columnheader">Etapa</span>
        <span role="columnheader">Candidaturas que chegaram</span>
        <span role="columnheader">Percentual das enviadas</span>
      </div>
      {steps.map((step) => {
        const width = (step.count / max) * 100;
        return (
          <div
            role="row"
            key={step.stage}
            className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span role="rowheader" className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: step.hex }} />
              <span className="truncate text-muted-foreground">{step.label}</span>
            </span>
            <span role="cell" className="relative h-5 rounded-r-[4px] bg-chart-track/60">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-accent transition-[width] duration-500",
                  step.count === 0 && "hidden",
                )}
                style={{ width: `max(${width}%, 4px)` }}
              />
            </span>
            <span role="cell" className="flex w-20 items-baseline justify-end gap-1.5 tabular-nums">
              <span className="font-medium">{step.count}</span>
              <span className="text-xs text-muted-foreground">
                {sent > 0 ? formatPercent(step.count / sent) : "—"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

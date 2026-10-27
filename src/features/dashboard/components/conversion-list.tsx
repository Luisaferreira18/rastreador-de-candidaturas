import { ArrowRight } from "lucide-react";
import { formatPercent } from "@/lib/format";
import type { ConversionStep } from "../metrics";

/** Taxa de aprovação de cada etapa: das que chegaram em X, quantas passaram para a seguinte. */
export function ConversionList({ steps }: { steps: ConversionStep[] }) {
  return (
    <ul className="space-y-3.5">
      {steps.map((step) => (
        <li key={step.from} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="truncate">{step.fromLabel}</span>
              <ArrowRight className="size-3 shrink-0" />
              <span className="truncate text-foreground">{step.toLabel}</span>
            </span>
            <span className="shrink-0 font-medium">{formatPercent(step.rate)}</span>
          </div>
          <div
            role="meter"
            aria-label={`Aprovação de ${step.fromLabel} para ${step.toLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={step.rate === null ? 0 : Math.round(step.rate * 100)}
            aria-valuetext={
              step.rate === null ? "Sem dados" : `${step.advanced} de ${step.reached} (${formatPercent(step.rate)})`
            }
            className="h-1.5 overflow-hidden rounded-full bg-chart-track"
          >
            <div
              className="h-full rounded-full bg-chart-accent transition-[width] duration-500"
              style={{ width: `${(step.rate ?? 0) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {step.reached === 0 ? "Nenhuma chegou aqui ainda" : `${step.advanced} de ${step.reached} avançaram`}
          </p>
        </li>
      ))}
    </ul>
  );
}

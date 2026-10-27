import { formatPercent } from "@/lib/format";
import type { DashboardMetrics } from "../metrics";

/** Candidaturas por plataforma: barras de uma cor só, com o valor escrito na ponta. */
export function PlatformBars({ items, total }: { items: DashboardMetrics["byPlatform"]; total: number }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.platform} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{item.label}</span>
          <span className="relative h-4">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-accent"
              style={{ width: `max(${(item.count / max) * 100}%, 4px)` }}
            />
          </span>
          <span className="w-16 text-right tabular-nums">
            <span className="font-medium">{item.count}</span>{" "}
            <span className="text-xs text-muted-foreground">{formatPercent(item.count / Math.max(total, 1))}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

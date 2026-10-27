import { diffDaysISO, formatDateTime, formatDayCount, timestampToISODate } from "@/lib/format";
import { getStage } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { StageHistoryEntry } from "../types";

function durationLabel(days: number): string {
  return days <= 0 ? "menos de 1 dia" : formatDayCount(days);
}

/** Linha do tempo das etapas, da mais antiga para a atual. */
export function StageTimeline({ history, today }: { history: StageHistoryEntry[]; today: string }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">Ainda não há mudanças de etapa registradas.</p>;
  }

  return (
    <ol className="relative">
      {history.map((entry, index) => {
        const stage = getStage(entry.to_stage);
        const isCurrent = index === history.length - 1;
        const startDay = timestampToISODate(entry.changed_at);
        const endDay = isCurrent ? today : timestampToISODate(history[index + 1].changed_at);
        const days = diffDaysISO(startDay, endDay);

        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isCurrent && <span aria-hidden className="absolute top-4 bottom-0 left-[7px] w-px bg-border" />}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                stage.dot,
                isCurrent && "ring-2 ring-offset-2 ring-offset-background",
              )}
              style={isCurrent ? ({ "--tw-ring-color": `${stage.hex}55` } as React.CSSProperties) : undefined}
            >
              <span className="size-1.5 rounded-full bg-white/90" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm font-medium">{stage.label}</p>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                    Atual
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <time dateTime={entry.changed_at}>{formatDateTime(entry.changed_at)}</time>
                {entry.from_stage ? <> · veio de {getStage(entry.from_stage).label}</> : <> · adicionada</>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isCurrent ? `Nesta etapa há ${durationLabel(days)}` : `Ficou ${durationLabel(days)} nesta etapa`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

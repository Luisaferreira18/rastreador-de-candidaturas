import { Check } from "lucide-react";
import { dateKindLabel } from "@/lib/concurso-options";
import { formatDateLong, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatTime, isUrgent, nextDate, sortSchedule } from "../schedule";
import type { ConcursoDate } from "../types";

/**
 * Cronograma em linha do tempo: o que já passou fica apagado, a próxima data
 * ganha destaque, e inscrição ou boleto vencendo em até 7 dias ficam em âmbar.
 */
export function ScheduleTimeline({ dates, today }: { dates: ConcursoDate[]; today: string }) {
  if (dates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma data no cronograma ainda. Edite o concurso para adicionar inscrições, prova e resultado.
      </p>
    );
  }

  const sorted = sortSchedule(dates);
  const next = nextDate(sorted, today);

  return (
    <ol className="relative">
      {sorted.map((item, index) => {
        const past = item.date < today;
        const isNext = item === next;
        const urgent = isUrgent(item, today);
        const time = formatTime(item.time);
        return (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < sorted.length - 1 && (
              <span aria-hidden className={cn("absolute top-4 bottom-0 left-[7px] w-px", past ? "bg-border" : "bg-border/70")} />
            )}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                past && "bg-muted-foreground/40",
                !past && !isNext && "border-2 border-muted-foreground/40 bg-background",
                isNext && (urgent ? "bg-amber-500" : "bg-primary"),
              )}
            >
              {past && <Check className="size-2.5 text-background" strokeWidth={3} />}
            </span>
            <div className={cn("min-w-0 flex-1", past && "text-muted-foreground")}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className={cn("text-sm", past ? "font-normal" : "font-medium")}>{dateKindLabel(item.kind)}</p>
                {isNext && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      urgent ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-primary/10 text-primary",
                    )}
                  >
                    Próxima
                  </span>
                )}
              </div>
              <p className={cn("text-xs", !past && urgent ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                <time dateTime={item.date}>{formatDateLong(item.date)}</time>
                {time && ` às ${time}`} · {formatRelativeDay(item.date, today)}
              </p>
              {item.note && <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

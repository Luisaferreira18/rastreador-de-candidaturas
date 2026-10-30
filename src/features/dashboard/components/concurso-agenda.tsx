import { AlertTriangle, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agendaConcursoName, type AgendaItem, type ConcursoAgenda } from "@/features/concursos/agenda";
import { dateKindLabel } from "@/lib/concurso-options";
import { formatDateShort, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_UPCOMING = 6;

function AgendaRow({ item, today, tone }: { item: AgendaItem; today: string; tone: "danger" | "warn" | "neutral" }) {
  return (
    <li className="relative flex items-start gap-3 rounded-lg border bg-card py-2 pr-3 pl-4 transition-colors hover:bg-accent/40">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-1.5 w-[3px] rounded-full",
          tone === "danger" && "bg-red-500",
          tone === "warn" && "bg-amber-500",
          tone === "neutral" && "bg-primary/60",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 font-medium">{dateKindLabel(item.kind)}</p>
        <Link
          href={`/concursos/${item.concursoId}`}
          className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground"
        >
          {agendaConcursoName(item)}
        </Link>
      </div>
      <div
        className={cn(
          "shrink-0 text-right text-xs",
          tone === "danger" && "text-red-600 dark:text-red-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        <p className="font-medium">{formatRelativeDay(item.date, today)}</p>
        <p className="text-muted-foreground">
          {formatDateShort(item.date)}
          {item.time && ` · ${item.time}`}
        </p>
      </div>
    </li>
  );
}

/**
 * Agenda dos concursos no painel: inscrição, isenção e boleto vencendo em até
 * 7 dias em destaque, e as outras datas do próximo mês.
 */
export function ConcursoAgendaCard({ agenda, today }: { agenda: ConcursoAgenda; today: string }) {
  const upcoming = agenda.upcoming.slice(0, MAX_UPCOMING);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Concursos</CardTitle>
        <CardDescription>Inscrições e boletos vencendo em até 7 dias e as próximas datas do cronograma.</CardDescription>
        <CardAction>
          <Link href="/concursos" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Ver concursos
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="concursos-atencao">
          <h3
            id="concursos-atencao"
            className={cn(
              "mb-1.5 flex items-center gap-1.5 text-xs font-semibold",
              agenda.alerts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            Atenção nos próximos 7 dias
            <span className="font-normal text-muted-foreground tabular-nums">{agenda.alerts.length}</span>
          </h3>
          {agenda.alerts.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Nenhuma inscrição, isenção ou boleto vencendo nesta semana.
            </p>
          ) : (
            <ul className="space-y-1">
              {agenda.alerts.map((item) => (
                <AgendaRow
                  key={`${item.concursoId}-${item.kind}-${item.date}-${item.time ?? ""}`}
                  item={item}
                  today={today}
                  tone={item.days <= 1 ? "danger" : "warn"}
                />
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="concursos-proximas">
          <h3 id="concursos-proximas" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
            Próximas datas
            <span className="font-normal text-muted-foreground tabular-nums">{agenda.upcoming.length}</span>
          </h3>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Nenhuma outra data nos próximos 30 dias.
            </p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((item) => (
                <AgendaRow key={`${item.concursoId}-${item.kind}-${item.date}-${item.time ?? ""}`} item={item} today={today} tone="neutral" />
              ))}
            </ul>
          )}
          {agenda.upcoming.length > upcoming.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              E mais {agenda.upcoming.length - upcoming.length} no próximo mês.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

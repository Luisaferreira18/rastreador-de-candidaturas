"use client";

import { CalendarClock, ListTodo, MapPin, MoreHorizontal, Pencil, Wallet } from "lucide-react";
import Link from "next/link";
import { CompanyAvatar } from "@/components/company-avatar";
import { PriorityIcon } from "@/components/priority-indicator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { justDragged } from "@/features/board/components/drag-guard";
import { MoveToMenuItems } from "@/features/board/components/move-to-menu";
import { CONCURSO_STAGES, type ConcursoStageKey } from "@/lib/concurso-stages";
import { formatCurrencyCompact, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { examCountdown, examCountdownLabel, isUrgent, nextDate, registrationLabel, registrationStatus } from "../schedule";
import type { ConcursoSummary } from "../types";
import { SphereBadge } from "./concurso-badges";

/** O que mais importa agora: inscrição ou boleto vencendo, a prova, ou a próxima data. */
function headline(card: ConcursoSummary, today: string): { text: string; urgent: boolean } | null {
  const urgent = card.dates.filter((item) => isUrgent(item, today)).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (urgent) {
    const label = urgent.kind === "boleto" ? "Boleto vence" : urgent.kind === "isencao" ? "Isenção até" : "Inscrições terminam";
    return { text: `${label} ${formatRelativeDay(urgent.date, today)}`, urgent: true };
  }
  const exam = examCountdown(card.dates, today);
  if (exam && exam.status !== "passou") return { text: examCountdownLabel(exam), urgent: exam.days <= 7 };
  const registration = registrationLabel(registrationStatus(card.dates, today));
  if (registration && registration !== "Inscrições encerradas") return { text: registration, urgent: false };
  const next = nextDate(card.dates, today);
  return next ? { text: `Próxima data ${formatRelativeDay(next.date, today)}`, urgent: false } : null;
}

export function ConcursoCard({
  card,
  today,
  onMove,
  overlay = false,
  placeholder = false,
}: {
  card: ConcursoSummary;
  today: string;
  onMove?: (stage: ConcursoStageKey) => void;
  overlay?: boolean;
  placeholder?: boolean;
}) {
  const place = [card.city, card.state].filter(Boolean).join("/") || (card.sphere === "federal" ? "Nacional" : null);
  const next = headline(card, today);

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-[border-color,box-shadow,opacity]",
        "hover:border-foreground/15 hover:shadow-sm",
        overlay && "rotate-[1.5deg] cursor-grabbing border-foreground/20 shadow-lg ring-1 ring-primary/20",
        placeholder && "opacity-40",
      )}
    >
      <Link
        href={`/concursos/${card.id}`}
        className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label={`${card.organ}, ${card.role_title}`}
        onClick={(event) => {
          if (justDragged()) event.preventDefault();
        }}
        draggable={false}
      />

      <div className="pointer-events-none relative flex items-start gap-2.5">
        <CompanyAvatar name={card.organ} />
        <div className="min-w-0 flex-1 pr-5">
          <p className="line-clamp-2 text-sm leading-5 font-medium">{card.organ}</p>
          <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{card.role_title}</p>
        </div>
      </div>

      <div className="pointer-events-none relative mt-2.5 flex items-center gap-2.5 text-xs text-muted-foreground">
        <SphereBadge sphere={card.sphere} className="h-[18px] px-1 text-[10px]" />
        {card.salary_cents !== null && (
          <span className="inline-flex shrink-0 items-center gap-1">
            <Wallet className="size-3" />
            {formatCurrencyCompact(card.salary_cents)}
          </span>
        )}
        {place && (
          <span className="inline-flex min-w-0 items-center gap-1" title={place}>
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{place}</span>
          </span>
        )}
      </div>

      <div className="pointer-events-none relative mt-2 flex items-center gap-3 text-xs">
        <PriorityIcon priority={card.priority} />
        {next && (
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-1",
              next.urgent ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3 shrink-0" />
            <span className="truncate">{next.text}</span>
          </span>
        )}
        {card.pendingTasks > 0 && (
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted-foreground"
            title={`${card.pendingTasks} próximo(s) passo(s) pendente(s)`}
          >
            <ListTodo className="size-3" />
            {card.pendingTasks}
          </span>
        )}
      </div>

      {card.progress.total > 0 && (
        <div className="pointer-events-none relative mt-2.5" title={`${card.progress.studiedPercent}% das matérias estudadas`}>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${card.progress.studiedPercent}%` }} />
          </div>
        </div>
      )}

      {onMove && !overlay && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-2 right-2 z-10 text-muted-foreground opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              aria-label={`Ações de ${card.organ}`}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/concursos/${card.id}/editar`}>
                <Pencil /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mover para</DropdownMenuLabel>
            <MoveToMenuItems stages={CONCURSO_STAGES} current={card.stage} onMove={onMove} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

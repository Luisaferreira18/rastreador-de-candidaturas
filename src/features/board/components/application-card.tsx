"use client";

import { Clock, ListTodo, MapPin, MoreHorizontal, Pencil, Wallet } from "lucide-react";
import Link from "next/link";
import { CompanyAvatar } from "@/components/company-avatar";
import { JobTypeBadge } from "@/components/job-type-badge";
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
import type { ApplicationSummary } from "@/features/applications/types";
import { dueStatus } from "@/features/tasks/upcoming";
import {
  diffDaysISO,
  formatCurrencyCompact,
  formatDayCount,
  formatRelativeDay,
  timestampToISODate,
} from "@/lib/format";
import { workModelLabel } from "@/lib/options";
import type { StageKey } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { MoveToMenuItems } from "./move-to-menu";

/** Momento do último "soltar": evita abrir o card logo depois de arrastá-lo. */
let lastDragEndedAt = 0;
export function markDragEnded() {
  lastDragEndedAt = Date.now();
}

const DUE_STYLES = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  soon: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
  done: "text-muted-foreground",
} as const;

export function ApplicationCard({
  card,
  today,
  onMove,
  overlay = false,
  placeholder = false,
}: {
  card: ApplicationSummary;
  today: string;
  onMove?: (stage: StageKey) => void;
  overlay?: boolean;
  placeholder?: boolean;
}) {
  const daysInStage = Math.max(0, diffDaysISO(timestampToISODate(card.stage_changed_at), today));
  const status = dueStatus({ id: card.id, title: "", done: false, due_date: card.nextDueDate }, today);
  const place = card.work_model === "remoto" ? "Remoto" : (card.location ?? workModelLabel(card.work_model));

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
        href={`/candidaturas/${card.id}`}
        className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label={`${card.company}, ${card.role_title}`}
        onClick={(event) => {
          if (Date.now() - lastDragEndedAt < 250) event.preventDefault();
        }}
        draggable={false}
      />

      <div className="pointer-events-none relative flex items-start gap-2.5">
        <CompanyAvatar name={card.company} />
        <div className="min-w-0 flex-1 pr-5">
          <p className="truncate text-sm leading-5 font-medium">{card.company}</p>
          <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{card.role_title}</p>
        </div>
      </div>

      {/* Uma linha só: tipo e remuneração sempre visíveis, o local encurta se faltar espaço. */}
      <div className="pointer-events-none relative mt-2.5 flex items-center gap-2.5 text-xs text-muted-foreground">
        <JobTypeBadge jobType={card.job_type} className="h-[18px] px-1 text-[10px]" />
        {card.salary_cents !== null && (
          <span className="inline-flex shrink-0 items-center gap-1">
            <Wallet className="size-3" />
            {formatCurrencyCompact(card.salary_cents)}
          </span>
        )}
        <span className="inline-flex min-w-0 items-center gap-1" title={place}>
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{place}</span>
        </span>
      </div>

      <div className="pointer-events-none relative mt-2 flex items-center gap-3 text-xs">
        <PriorityIcon priority={card.priority} />
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title={`Nesta etapa ${daysInStage === 0 ? "desde hoje" : `há ${formatDayCount(daysInStage)}`}`}
        >
          <Clock className="size-3" />
          {daysInStage === 0 ? "hoje" : formatDayCount(daysInStage)}
        </span>
        {card.pendingTasks > 0 && (
          <span
            className={cn("ml-auto inline-flex items-center gap-1 font-medium", DUE_STYLES[status])}
            title={`${card.pendingTasks} próximo(s) passo(s) pendente(s)`}
          >
            <ListTodo className="size-3" />
            {card.nextDueDate ? formatRelativeDay(card.nextDueDate, today) : card.pendingTasks}
          </span>
        )}
      </div>

      {onMove && !overlay && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-2 right-2 z-10 text-muted-foreground opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              aria-label={`Ações de ${card.company}`}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/candidaturas/${card.id}/editar`}>
                <Pencil /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mover para</DropdownMenuLabel>
            <MoveToMenuItems current={card.stage} onMove={onMove} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

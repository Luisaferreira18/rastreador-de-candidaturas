"use client";

import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskWithParent } from "@/features/applications/types";
import { setTaskDone } from "@/features/tasks/actions";
import { groupUpcomingTasks } from "@/features/tasks/upcoming";
import { formatDateShort, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const GROUPS = [
  { key: "overdue", title: "Atrasadas", tone: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  { key: "today", title: "Hoje", tone: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  { key: "soon", title: "Próximos 7 dias", tone: "text-foreground", bar: "bg-primary" },
] as const;

/** Tarefas com prazo nos próximos 7 dias (e as atrasadas), de candidaturas e concursos, agrupadas e em destaque. */
export function UpcomingDeadlines({ tasks, today }: { tasks: TaskWithParent[]; today: string }) {
  const [visible, removeOptimistic] = useOptimistic(tasks, (current, id: string) =>
    current.filter((task) => task.id !== id),
  );
  const groups = groupUpcomingTasks(visible, today);
  const total = groups.overdue.length + groups.today.length + groups.soon.length;

  function complete(task: TaskWithParent) {
    startTransition(async () => {
      removeOptimistic(task.id);
      const result = await setTaskDone(task.id, true);
      if (!result.ok) toast.error(result.error);
      else toast.success(`Concluída: ${task.title}`);
    });
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Nenhum prazo nos próximos 7 dias"
        description="Adicione próximos passos com data na página de cada candidatura ou concurso."
        compact
        className="border-0"
      />
    );
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => {
        const items = groups[group.key];
        if (items.length === 0) return null;
        return (
          <section key={group.key} aria-label={group.title}>
            <h3 className={cn("mb-1.5 flex items-center gap-2 text-xs font-semibold", group.tone)}>
              {group.title}
              <span className="font-normal text-muted-foreground tabular-nums">{items.length}</span>
            </h3>
            <ul className="space-y-1">
              {items.map((task) => (
                <li
                  key={task.id}
                  className="relative flex items-start gap-3 rounded-lg border bg-card py-2 pr-3 pl-4 transition-colors hover:bg-accent/40"
                >
                  <span aria-hidden className={cn("absolute inset-y-2 left-1.5 w-[3px] rounded-full", group.bar)} />
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => complete(task)}
                    className="mt-0.5"
                    aria-label={`Concluir: ${task.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-5">{task.title}</p>
                    <Link
                      href={task.parent.href}
                      className="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", task.parent.dot)} />
                      <span className="truncate">{task.parent.name}</span>
                    </Link>
                  </div>
                  <div className={cn("shrink-0 text-right text-xs", group.tone)}>
                    <p className="font-medium">{formatRelativeDay(task.due_date!, today)}</p>
                    <p className="text-muted-foreground">{formatDateShort(task.due_date!)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

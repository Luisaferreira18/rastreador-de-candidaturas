"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, ListTodo, Loader2, Plus, Trash2 } from "lucide-react";
import { startTransition, useOptimistic, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Task } from "@/features/applications/types";
import { formatDate, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createTask, deleteTask, setTaskDone } from "../actions";
import { taskFormSchema, type TaskFormValues } from "../schema";
import { dueStatus } from "../upcoming";

type OptimisticAction =
  | { type: "add"; task: Task }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "remove"; id: string };

const DUE_STYLES = {
  overdue: "text-red-600 dark:text-red-400 font-medium",
  today: "text-amber-600 dark:text-amber-400 font-medium",
  soon: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
  done: "text-muted-foreground",
} as const;

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.created_at.localeCompare(b.created_at),
  );
}

/** Próximos passos de uma candidatura: criar, concluir e excluir, com resposta instantânea. */
export function TaskList({ applicationId, tasks, today }: { applicationId: string; tasks: Task[]; today: string }) {
  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, (current: Task[], action: OptimisticAction) => {
    switch (action.type) {
      case "add":
        return [...current, action.task];
      case "toggle":
        return current.map((task) => (task.id === action.id ? { ...task, done: action.done } : task));
      case "remove":
        return current.filter((task) => task.id !== action.id);
    }
  });
  const [adding, startAdding] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: "", dueDate: "" },
  });

  const onSubmit = handleSubmit((values) => {
    startAdding(async () => {
      applyOptimistic({
        type: "add",
        task: {
          id: `temp-${Date.now()}`,
          application_id: applicationId,
          user_id: "",
          title: values.title.trim(),
          due_date: values.dueDate || null,
          done: false,
          completed_at: null,
          created_at: new Date().toISOString(),
        },
      });
      const result = await createTask(applicationId, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      reset();
      setFocus("title");
      toast.success("Próximo passo adicionado.");
    });
  });

  function toggle(task: Task, done: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id: task.id, done });
      const result = await setTaskDone(task.id, done);
      if (!result.ok) toast.error(result.error);
      else if (done) toast.success("Tarefa concluída. Boa!");
    });
  }

  function remove(task: Task) {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: task.id });
      const result = await deleteTask(task.id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Tarefa excluída.");
    });
  }

  const sorted = sortTasks(optimisticTasks);
  const pending = sorted.filter((task) => !task.done).length;

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nenhum próximo passo"
          description='Anote o que precisa fazer, como "entregar o case até sexta".'
          compact
        />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label={`${pending} próximos passos pendentes`}>
          {sorted.map((task) => {
            const status = dueStatus(task, today);
            const temporary = task.id.startsWith("temp-");
            return (
              <li key={task.id} className={cn("group flex items-start gap-3 px-3 py-2.5", temporary && "opacity-60")}>
                <Checkbox
                  id={`task-${task.id}`}
                  checked={task.done}
                  disabled={temporary}
                  onCheckedChange={(checked) => toggle(task, checked === true)}
                  className="mt-0.5"
                  aria-label={task.done ? `Reabrir: ${task.title}` : `Concluir: ${task.title}`}
                />
                <label htmlFor={`task-${task.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span
                    className={cn(
                      "block text-sm break-words",
                      task.done && "text-muted-foreground line-through decoration-muted-foreground/50",
                    )}
                  >
                    {task.title}
                  </span>
                  {task.due_date && (
                    <span className={cn("mt-0.5 inline-flex items-center gap-1 text-xs", DUE_STYLES[status])}>
                      <CalendarClock className="size-3" />
                      {formatDate(task.due_date)}
                      {!task.done && <> · {formatRelativeDay(task.due_date, today)}</>}
                      {status === "overdue" && " (atrasada)"}
                    </span>
                  )}
                </label>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => remove(task)}
                  disabled={temporary}
                  aria-label={`Excluir: ${task.title}`}
                  className="text-muted-foreground opacity-100 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onSubmit} className="space-y-1.5" noValidate>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            {...register("title")}
            placeholder="Novo próximo passo…"
            aria-label="Novo próximo passo"
            aria-invalid={errors.title ? true : undefined}
            className="h-8 flex-1"
            disabled={adding}
          />
          <div className="flex gap-2">
            <Input
              {...register("dueDate")}
              type="date"
              aria-label="Prazo"
              className="h-8 w-full sm:w-38"
              disabled={adding}
            />
            <Button type="submit" size="sm" disabled={adding} className="shrink-0">
              {adding ? <Loader2 className="animate-spin" /> : <Plus />}
              Adicionar
            </Button>
          </div>
        </div>
        {(errors.title || errors.dueDate) && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.title?.message ?? errors.dueDate?.message}
          </p>
        )}
      </form>
    </div>
  );
}

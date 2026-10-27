import { addDaysISO } from "@/lib/format";

export type DatedTask = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
};

export type UpcomingGroups<T extends DatedTask> = {
  overdue: T[];
  today: T[];
  soon: T[];
};

/**
 * Separa as tarefas pendentes em atrasadas, para hoje e para os próximos
 * `days` dias. Tarefas concluídas, sem data ou mais distantes ficam de fora.
 */
export function groupUpcomingTasks<T extends DatedTask>(
  tasks: readonly T[],
  today: string,
  days = 7,
): UpcomingGroups<T> {
  const limit = addDaysISO(today, days);
  const groups: UpcomingGroups<T> = { overdue: [], today: [], soon: [] };

  const pending = tasks
    .filter((task): task is T & { due_date: string } => !task.done && task.due_date !== null)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  for (const task of pending) {
    if (task.due_date < today) groups.overdue.push(task);
    else if (task.due_date === today) groups.today.push(task);
    else if (task.due_date <= limit) groups.soon.push(task);
  }
  return groups;
}

export type DueStatus = "done" | "overdue" | "today" | "soon" | "later" | "none";

export function dueStatus(task: DatedTask, today: string, days = 7): DueStatus {
  if (task.done) return "done";
  if (!task.due_date) return "none";
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  if (task.due_date <= addDaysISO(today, days)) return "soon";
  return "later";
}

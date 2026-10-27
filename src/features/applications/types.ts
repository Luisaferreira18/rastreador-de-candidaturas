import type { Tables } from "@/types/database";

export type Application = Tables<"applications">;
export type StageHistoryEntry = Tables<"stage_history">;
export type Task = Tables<"tasks">;

/** Candidatura com o resumo das tarefas pendentes (usada no quadro e na lista). */
export type ApplicationSummary = Application & {
  pendingTasks: number;
  nextDueDate: string | null;
};

export type ApplicationDetail = {
  application: Application;
  history: StageHistoryEntry[];
  tasks: Task[];
};

/** Tarefa com os dados básicos da candidatura (lista de próximos prazos). */
export type TaskWithApplication = Task & {
  application: Pick<Application, "id" | "company" | "role_title" | "stage">;
};

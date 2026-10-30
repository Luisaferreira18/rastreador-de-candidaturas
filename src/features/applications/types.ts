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

/**
 * Tarefa com o nome, o link e a cor da etapa da candidatura ou do concurso a
 * que pertence (lista de próximos prazos do painel).
 */
export type TaskWithParent = Task & {
  parent: { href: string; name: string; dot: string };
};

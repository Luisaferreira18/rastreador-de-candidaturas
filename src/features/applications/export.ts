import { toCsv } from "@/lib/csv";
import { formatDate, formatDateTime, centsToInput } from "@/lib/format";
import { jobTypeLabel, platformLabel, priorityOption, workModelLabel } from "@/lib/options";
import { getStage } from "@/lib/stages";
import type { Application, StageHistoryEntry, Task } from "./types";

const HEADER = [
  "Empresa",
  "Cargo",
  "Tipo de vaga",
  "Etapa atual",
  "Prioridade",
  "Plataforma",
  "Modelo",
  "Local",
  "Remuneração (R$)",
  "Data da candidatura",
  "Link da vaga",
  "Observações",
  "Próximos passos",
  "Linha do tempo",
  "Criada em",
  "Atualizada em",
];

/**
 * Monta o CSV com tudo: uma linha por candidatura, com as tarefas e a linha
 * do tempo resumidas em colunas de texto.
 */
export function buildApplicationsCsv(data: {
  applications: Application[];
  history: StageHistoryEntry[];
  tasks: Task[];
}): string {
  const historyByApplication = Map.groupBy(data.history, (entry) => entry.application_id);
  const tasksByApplication = Map.groupBy(data.tasks, (task) => task.application_id);

  const rows = data.applications.map((application) => {
    const tasks = (tasksByApplication.get(application.id) ?? [])
      .map((task) => {
        const due = task.due_date ? ` (até ${formatDate(task.due_date)})` : "";
        return `${task.done ? "[feita] " : ""}${task.title}${due}`;
      })
      .join(" | ");
    const timeline = (historyByApplication.get(application.id) ?? [])
      .map((entry) => `${getStage(entry.to_stage).label} em ${formatDateTime(entry.changed_at)}`)
      .join(" → ");

    return [
      application.company,
      application.role_title,
      jobTypeLabel(application.job_type),
      getStage(application.stage).label,
      priorityOption(application.priority).label,
      platformLabel(application.platform),
      workModelLabel(application.work_model),
      application.location,
      application.salary_cents === null ? null : centsToInput(application.salary_cents),
      application.applied_at ? formatDate(application.applied_at) : null,
      application.job_url,
      application.notes,
      tasks,
      timeline,
      formatDateTime(application.created_at),
      formatDateTime(application.updated_at),
    ];
  });

  return toCsv(HEADER, rows);
}

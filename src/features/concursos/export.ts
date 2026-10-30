import { toCsv } from "@/lib/csv";
import { dateKindLabel, educationLabel, sphereLabel, subjectStatusLabel } from "@/lib/concurso-options";
import { getConcursoStage } from "@/lib/concurso-stages";
import { centsToInput, formatDate, formatDateTime } from "@/lib/format";
import { priorityOption } from "@/lib/options";
import type { Task } from "@/features/applications/types";
import { formatTime, sortSchedule } from "./schedule";
import { subjectProgress } from "./subjects";
import type { Concurso, ConcursoDate, ConcursoHistoryEntry, ConcursoSubject } from "./types";

const HEADER = [
  "Órgão",
  "Cargo",
  "Banca",
  "Esfera",
  "Escolaridade",
  "Área",
  "Salário (R$)",
  "Vagas",
  "Cadastro reserva",
  "Cidade",
  "UF",
  "Etapa atual",
  "Prioridade",
  "Cronograma",
  "Matérias",
  "Progresso nas matérias",
  "Próximos passos",
  "Link do edital",
  "Link da inscrição",
  "Observações",
  "Linha do tempo",
  "Criado em",
  "Atualizado em",
];

/**
 * Monta o CSV dos concursos: uma linha por concurso, com o cronograma, as
 * matérias, as tarefas e a linha do tempo resumidos em colunas de texto.
 */
export function buildConcursosCsv(data: {
  concursos: Concurso[];
  dates: ConcursoDate[];
  subjects: ConcursoSubject[];
  history: ConcursoHistoryEntry[];
  tasks: Task[];
}): string {
  const datesById = Map.groupBy(data.dates, (item) => item.concurso_id);
  const subjectsById = Map.groupBy(data.subjects, (item) => item.concurso_id);
  const historyById = Map.groupBy(data.history, (entry) => entry.concurso_id);
  const tasksById = Map.groupBy(
    data.tasks.filter((task) => task.concurso_id),
    (task) => task.concurso_id,
  );

  const rows = data.concursos.map((concurso) => {
    const schedule = sortSchedule(datesById.get(concurso.id) ?? [])
      .map((item) => {
        const time = formatTime(item.time);
        return `${dateKindLabel(item.kind)}: ${formatDate(item.date)}${time ? ` ${time}` : ""}${item.note ? ` (${item.note})` : ""}`;
      })
      .join(" | ");
    const subjects = [...(subjectsById.get(concurso.id) ?? [])].sort((a, b) => a.position - b.position);
    const subjectList = subjects
      .map((subject) => {
        const details = [
          subject.weight !== null ? `peso ${String(subject.weight).replace(".", ",")}` : null,
          subject.questions !== null ? `${subject.questions} questões` : null,
          subjectStatusLabel(subject.status).toLowerCase(),
        ].filter(Boolean);
        return `${subject.name} (${details.join(", ")})`;
      })
      .join(" | ");
    const progress = subjectProgress(subjects);
    const tasks = (tasksById.get(concurso.id) ?? [])
      .map((task) => `${task.done ? "[feita] " : ""}${task.title}${task.due_date ? ` (até ${formatDate(task.due_date)})` : ""}`)
      .join(" | ");
    const timeline = [...(historyById.get(concurso.id) ?? [])]
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
      .map((entry) => `${getConcursoStage(entry.to_stage).label} em ${formatDateTime(entry.changed_at)}`)
      .join(" → ");

    return [
      concurso.organ,
      concurso.role_title,
      concurso.exam_board,
      sphereLabel(concurso.sphere),
      educationLabel(concurso.education),
      concurso.area,
      concurso.salary_cents === null ? null : centsToInput(concurso.salary_cents),
      concurso.vacancies,
      concurso.reserve_list ? "Sim" : "Não",
      concurso.city,
      concurso.state,
      getConcursoStage(concurso.stage).label,
      priorityOption(concurso.priority).label,
      schedule,
      subjectList,
      subjects.length > 0 ? `${progress.studiedPercent}% estudado, ${progress.reviewedPercent}% revisado` : null,
      tasks,
      concurso.notice_url,
      concurso.registration_url,
      concurso.notes,
      timeline,
      formatDateTime(concurso.created_at),
      formatDateTime(concurso.updated_at),
    ];
  });

  return toCsv(HEADER, rows);
}

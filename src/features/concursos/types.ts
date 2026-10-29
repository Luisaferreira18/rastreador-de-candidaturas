import type { Task } from "@/features/applications/types";
import type { Tables } from "@/types/database";
import type { SubjectProgress } from "./subjects";

export type Concurso = Tables<"concursos">;
export type ConcursoDate = Tables<"concurso_dates">;
export type ConcursoSubject = Tables<"concurso_subjects">;
export type ConcursoHistoryEntry = Tables<"concurso_stage_history">;

/** Data do cronograma sem os campos de controle (o que os cálculos usam). */
export type ScheduleDate = Pick<ConcursoDate, "kind" | "date" | "time">;

/** Concurso com o que o quadro e a lista mostram do cronograma, das matérias e das tarefas. */
export type ConcursoSummary = Concurso & {
  dates: ScheduleDate[];
  progress: SubjectProgress;
  pendingTasks: number;
  nextDueDate: string | null;
};

export type ConcursoDetail = {
  concurso: Concurso;
  history: ConcursoHistoryEntry[];
  dates: ConcursoDate[];
  subjects: ConcursoSubject[];
  tasks: Task[];
};

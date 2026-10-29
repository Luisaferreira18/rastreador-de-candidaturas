import { z } from "zod";
import { UF_VALUES } from "@/features/job-search/brazil";
import {
  DATE_KIND_VALUES,
  EDUCATION_VALUES,
  SPHERE_VALUES,
  SUBJECT_STATUS_VALUES,
  type DateKind,
  type SubjectStatus,
} from "@/lib/concurso-options";
import { CONCURSO_STAGE_KEYS } from "@/lib/concurso-stages";
import { centsToInput, isValidISODate, parseBRLToCents } from "@/lib/format";
import { PRIORITY_VALUES } from "@/lib/options";
import { isHttpUrl, normalizeUrl } from "@/lib/url";
import type { TablesInsert } from "@/types/database";
import { sortSchedule } from "./schedule";
import type { Concurso, ConcursoDate, ConcursoSubject } from "./types";

const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);

const optionalUrl = z
  .string()
  .trim()
  .max(2048, "Esse link é longo demais.")
  .refine((value) => value === "" || isHttpUrl(normalizeUrl(value)), {
    message: "Link inválido. Cole o endereço completo, como https://...",
  });

/** "1,5" ou "2" → número; vazio → null. */
export function parseDecimal(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  return /^\d{1,4}(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : null;
}

export const scheduleRowSchema = z.object({
  kind: z.enum(DATE_KIND_VALUES, { error: "Escolha o tipo da data." }),
  date: z.string().trim().refine(isValidISODate, { message: "Informe a data." }),
  time: z
    .string()
    .trim()
    .refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), { message: "Hora inválida." }),
  note: optionalText(200),
});

export const subjectRowSchema = z.object({
  /** Matéria que já existe (para guardar o que já foi estudado ao editar). */
  id: z.string(),
  name: z.string().trim().min(1, "Informe a matéria.").max(120, "Use no máximo 120 caracteres."),
  weight: z
    .string()
    .trim()
    .refine((value) => value === "" || parseDecimal(value) !== null, { message: "Peso inválido." }),
  questions: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,3}$/.test(value), { message: "Use só números." }),
  status: z.enum(SUBJECT_STATUS_VALUES),
});

/**
 * Formulário do concurso, com o cronograma e as matérias. Os campos opcionais
 * são texto (vazio = não informado), como chegam dos inputs. O mesmo schema
 * valida no navegador (React Hook Form) e de novo no servidor (Server Action).
 */
export const concursoFormSchema = z.object({
  organ: z.string().trim().min(1, "Informe o órgão.").max(160, "Use no máximo 160 caracteres."),
  roleTitle: z.string().trim().min(1, "Informe o cargo.").max(160, "Use no máximo 160 caracteres."),
  examBoard: optionalText(80),
  area: optionalText(80),
  sphere: z.enum(SPHERE_VALUES, { error: "Escolha a esfera." }),
  education: z.enum(EDUCATION_VALUES, { error: "Escolha a escolaridade." }),
  salary: z
    .string()
    .trim()
    .refine((value) => value === "" || parseBRLToCents(value) !== null, {
      message: "Valor inválido. Use o formato 4.500,00.",
    })
    .refine((value) => value === "" || (parseBRLToCents(value) ?? 0) <= 100_000_000, {
      message: "Esse valor parece alto demais.",
    }),
  vacancies: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,5}$/.test(value), { message: "Use só números." }),
  reserveList: z.boolean(),
  city: optionalText(120),
  state: z.union([z.literal(""), z.enum(UF_VALUES)], { error: "Estado inválido." }),
  noticeUrl: optionalUrl,
  registrationUrl: optionalUrl,
  stage: z.enum(CONCURSO_STAGE_KEYS, { error: "Escolha a etapa atual." }),
  priority: z.enum(PRIORITY_VALUES, { error: "Escolha a prioridade." }),
  notes: z.string().max(10_000, "As observações passaram de 10.000 caracteres."),
  dates: z.array(scheduleRowSchema).max(30, "Use no máximo 30 datas."),
  subjects: z.array(subjectRowSchema).max(60, "Use no máximo 60 matérias."),
});

export type ConcursoFormValues = z.infer<typeof concursoFormSchema>;
export type ScheduleRowValues = z.infer<typeof scheduleRowSchema>;
export type SubjectRowValues = z.infer<typeof subjectRowSchema>;

export type ConcursoPayload = Pick<
  TablesInsert<"concursos">,
  | "organ"
  | "role_title"
  | "exam_board"
  | "area"
  | "sphere"
  | "education"
  | "salary_cents"
  | "vacancies"
  | "reserve_list"
  | "city"
  | "state"
  | "notice_url"
  | "registration_url"
  | "stage"
  | "priority"
  | "notes"
>;

const emptyToNull = (value: string) => (value.trim() === "" ? null : value.trim());

/** Converte os valores do formulário (já validados) nas colunas do concurso. */
export function toConcursoPayload(values: ConcursoFormValues): ConcursoPayload {
  return {
    organ: values.organ.trim(),
    role_title: values.roleTitle.trim(),
    exam_board: emptyToNull(values.examBoard),
    area: emptyToNull(values.area),
    sphere: values.sphere,
    education: values.education,
    salary_cents: values.salary.trim() === "" ? null : parseBRLToCents(values.salary),
    vacancies: values.vacancies.trim() === "" ? null : Number(values.vacancies),
    reserve_list: values.reserveList,
    city: emptyToNull(values.city),
    state: values.state || null,
    notice_url: emptyToNull(normalizeUrl(values.noticeUrl)),
    registration_url: emptyToNull(normalizeUrl(values.registrationUrl)),
    stage: values.stage,
    priority: values.priority,
    notes: emptyToNull(values.notes),
  };
}

/** Linhas do cronograma para gravar (sem repetir a mesma data do mesmo tipo). */
export function toDateRows(
  concursoId: string,
  userId: string,
  rows: readonly ScheduleRowValues[],
): TablesInsert<"concurso_dates">[] {
  const seen = new Set<string>();
  const result: TablesInsert<"concurso_dates">[] = [];
  for (const row of sortSchedule(rows.map((item) => ({ ...item, time: item.time || null })))) {
    const key = `${row.kind}|${row.date}|${row.time ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      concurso_id: concursoId,
      user_id: userId,
      kind: row.kind as DateKind,
      date: row.date,
      time: row.time,
      note: emptyToNull(row.note),
    });
  }
  return result;
}

/**
 * Matérias para gravar, na ordem do formulário. As que já existiam mantêm o
 * id (e o status); as novas recebem um id novo.
 */
export function toSubjectRows(
  concursoId: string,
  userId: string,
  rows: readonly SubjectRowValues[],
  existingIds: ReadonlySet<string>,
  newId: () => string,
): TablesInsert<"concurso_subjects">[] {
  return rows.map((row, index) => ({
    id: existingIds.has(row.id) ? row.id : newId(),
    concurso_id: concursoId,
    user_id: userId,
    name: row.name.trim(),
    weight: parseDecimal(row.weight),
    questions: row.questions.trim() === "" ? null : Number(row.questions),
    status: row.status as SubjectStatus,
    position: index,
  }));
}

/** Valores iniciais do formulário a partir de um concurso existente. */
export function toConcursoFormValues(
  concurso: Concurso,
  dates: readonly ConcursoDate[],
  subjects: readonly ConcursoSubject[],
): ConcursoFormValues {
  return {
    organ: concurso.organ,
    roleTitle: concurso.role_title,
    examBoard: concurso.exam_board ?? "",
    area: concurso.area ?? "",
    sphere: concurso.sphere,
    education: concurso.education,
    salary: centsToInput(concurso.salary_cents),
    vacancies: concurso.vacancies === null ? "" : String(concurso.vacancies),
    reserveList: concurso.reserve_list,
    city: concurso.city ?? "",
    state: (concurso.state ?? "") as ConcursoFormValues["state"],
    noticeUrl: concurso.notice_url ?? "",
    registrationUrl: concurso.registration_url ?? "",
    stage: concurso.stage,
    priority: concurso.priority,
    notes: concurso.notes ?? "",
    dates: sortSchedule(dates).map((item) => ({
      kind: item.kind,
      date: item.date,
      time: item.time ? item.time.slice(0, 5) : "",
      note: item.note ?? "",
    })),
    subjects: [...subjects]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        name: item.name,
        weight: item.weight === null ? "" : String(item.weight).replace(".", ","),
        questions: item.questions === null ? "" : String(item.questions),
        status: item.status,
      })),
  };
}

export const emptyConcursoFormValues: ConcursoFormValues = {
  organ: "",
  roleTitle: "",
  examBoard: "",
  area: "",
  sphere: "federal",
  education: "superior",
  salary: "",
  vacancies: "",
  reserveList: false,
  city: "",
  state: "",
  noticeUrl: "",
  registrationUrl: "",
  stage: "acompanhando",
  priority: "media",
  notes: "",
  dates: [],
  subjects: [],
};

/** Mudança de etapa (quadro, menu "Mover para" e página de detalhe). */
export const moveConcursoSchema = z.object({
  id: z.uuid({ error: "Concurso inválido." }),
  stage: z.enum(CONCURSO_STAGE_KEYS, { error: "Etapa inválida." }),
  position: z.number().finite().optional(),
});

export type MoveConcursoInput = z.infer<typeof moveConcursoSchema>;

/** Desfazer uma mudança de etapa feita por engano (volta tudo e limpa o histórico). */
export const undoMoveConcursoSchema = z.object({
  id: z.uuid({ error: "Concurso inválido." }),
  movedTo: z.enum(CONCURSO_STAGE_KEYS),
  movedAt: z.iso.datetime({ offset: true }),
  previousStage: z.enum(CONCURSO_STAGE_KEYS),
  previousPosition: z.number().finite(),
  previousStageChangedAt: z.iso.datetime({ offset: true }),
});

export type UndoMoveConcursoInput = z.infer<typeof undoMoveConcursoSchema>;

export const subjectStatusSchema = z.object({
  id: z.uuid({ error: "Matéria inválida." }),
  status: z.enum(SUBJECT_STATUS_VALUES),
});

import { z } from "zod";
import { centsToInput, isValidISODate, parseBRLToCents } from "@/lib/format";
import { JOB_TYPE_VALUES, PLATFORM_VALUES, PRIORITY_VALUES, WORK_MODEL_VALUES } from "@/lib/options";
import { STAGE_KEYS } from "@/lib/stages";
import type { Tables, TablesInsert } from "@/types/database";

/** Acrescenta https:// quando a pessoa cola só "gupy.io/vaga/123". */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Schema do formulário de candidatura. Os campos opcionais são texto
 * (vazio = não informado), como chegam dos inputs. O mesmo schema valida
 * no navegador (React Hook Form) e de novo no servidor (Server Action).
 */
export const applicationFormSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1, "Informe o nome da empresa.")
    .max(120, "Use no máximo 120 caracteres."),
  roleTitle: z
    .string()
    .trim()
    .min(1, "Informe o cargo ou o nome da vaga.")
    .max(160, "Use no máximo 160 caracteres."),
  jobType: z.enum(JOB_TYPE_VALUES, { error: "Escolha o tipo de vaga." }),
  jobUrl: z
    .string()
    .trim()
    .max(2048, "Esse link é longo demais.")
    .refine((value) => value === "" || isHttpUrl(normalizeUrl(value)), {
      message: "Link inválido. Cole o endereço completo da vaga, como https://...",
    }),
  platform: z.enum(PLATFORM_VALUES, { error: "Escolha onde a vaga foi encontrada." }),
  location: z.string().trim().max(120, "Use no máximo 120 caracteres."),
  workModel: z.enum(WORK_MODEL_VALUES, { error: "Escolha o modelo de trabalho." }),
  salary: z
    .string()
    .trim()
    .refine((value) => value === "" || parseBRLToCents(value) !== null, {
      message: "Valor inválido. Use o formato 1.800,00.",
    })
    .refine((value) => value === "" || (parseBRLToCents(value) ?? 0) <= 100_000_000, {
      message: "Esse valor parece alto demais.",
    }),
  appliedAt: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidISODate(value), { message: "Data inválida." }),
  stage: z.enum(STAGE_KEYS, { error: "Escolha a etapa atual." }),
  priority: z.enum(PRIORITY_VALUES, { error: "Escolha a prioridade." }),
  notes: z.string().max(10_000, "As observações passaram de 10.000 caracteres."),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

/** Colunas que o formulário controla (o resto é preenchido pelo banco). */
export type ApplicationPayload = Pick<
  TablesInsert<"applications">,
  | "company"
  | "role_title"
  | "job_type"
  | "job_url"
  | "platform"
  | "location"
  | "work_model"
  | "salary_cents"
  | "applied_at"
  | "stage"
  | "priority"
  | "notes"
>;

/** Converte os valores do formulário (já validados) nas colunas do banco. */
export function toApplicationPayload(values: ApplicationFormValues): ApplicationPayload {
  const emptyToNull = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    company: values.company.trim(),
    role_title: values.roleTitle.trim(),
    job_type: values.jobType,
    job_url: emptyToNull(normalizeUrl(values.jobUrl)),
    platform: values.platform,
    location: emptyToNull(values.location),
    work_model: values.workModel,
    salary_cents: values.salary.trim() === "" ? null : parseBRLToCents(values.salary),
    applied_at: emptyToNull(values.appliedAt),
    stage: values.stage,
    priority: values.priority,
    notes: emptyToNull(values.notes),
  };
}

/** Valores iniciais do formulário a partir de uma candidatura existente. */
export function toApplicationFormValues(application: Tables<"applications">): ApplicationFormValues {
  return {
    company: application.company,
    roleTitle: application.role_title,
    jobType: application.job_type,
    jobUrl: application.job_url ?? "",
    platform: application.platform,
    location: application.location ?? "",
    workModel: application.work_model,
    salary: centsToInput(application.salary_cents),
    appliedAt: application.applied_at ?? "",
    stage: application.stage,
    priority: application.priority,
    notes: application.notes ?? "",
  };
}

export const emptyApplicationFormValues: ApplicationFormValues = {
  company: "",
  roleTitle: "",
  jobType: "estagio",
  jobUrl: "",
  platform: "linkedin",
  location: "",
  workModel: "hibrido",
  salary: "",
  appliedAt: "",
  stage: "quero_candidatar",
  priority: "media",
  notes: "",
};

/** Mudança de etapa (Kanban, menu "Mover para" e página de detalhe). */
export const moveApplicationSchema = z.object({
  id: z.uuid({ error: "Candidatura inválida." }),
  stage: z.enum(STAGE_KEYS, { error: "Etapa inválida." }),
  position: z.number().finite().optional(),
});

export type MoveApplicationInput = z.infer<typeof moveApplicationSchema>;

/**
 * Desfazer uma mudança de etapa: volta a etapa, a posição e a data da etapa
 * anterior, e apaga do histórico o movimento feito por engano (para não
 * distorcer o funil).
 */
export const undoMoveSchema = z.object({
  id: z.uuid({ error: "Candidatura inválida." }),
  movedTo: z.enum(STAGE_KEYS),
  movedAt: z.iso.datetime({ offset: true }),
  previousStage: z.enum(STAGE_KEYS),
  previousPosition: z.number().finite(),
  previousStageChangedAt: z.iso.datetime({ offset: true }),
});

export type UndoMoveInput = z.infer<typeof undoMoveSchema>;

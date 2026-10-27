import { z } from "zod";
import { centsToInput, parseBRLToCents } from "@/lib/format";
import { JOB_TYPE_VALUES, WORK_MODEL_VALUES } from "@/lib/options";
import type { Tables, TablesInsert } from "@/types/database";
import { boardKey, parseBoardInput } from "./boards";
import { UF_VALUES } from "./brazil";
import type { BoardRef, SearchProfile } from "./types";

export const MAX_ROLES = 5;

const tag = (max: number) =>
  z.string().trim().min(2, "Use pelo menos 2 letras.").max(max, `Use no máximo ${max} caracteres.`);

/**
 * Formulário do perfil de busca. Valida no navegador (React Hook Form) e de
 * novo no servidor (Server Action).
 */
export const jobProfileFormSchema = z
  .object({
    roles: z.array(tag(60)).min(1, "Informe pelo menos um cargo.").max(MAX_ROLES, `Use no máximo ${MAX_ROLES} cargos.`),
    jobTypes: z.array(z.enum(JOB_TYPE_VALUES)).min(1, "Escolha pelo menos um tipo de vaga."),
    workModels: z.array(z.enum(WORK_MODEL_VALUES)).min(1, "Escolha pelo menos um modelo de trabalho."),
    city: z.string().trim().max(80, "Use no máximo 80 caracteres."),
    state: z.union([z.literal(""), z.enum(UF_VALUES)], { error: "Estado inválido." }),
    minSalary: z
      .string()
      .trim()
      .refine((value) => value === "" || parseBRLToCents(value) !== null, {
        message: "Valor inválido. Use o formato 1.500,00.",
      }),
    keywords: z.array(tag(40)).max(30, "Use no máximo 30 palavras-chave."),
    excludedWords: z.array(tag(40)).max(30, "Use no máximo 30 palavras."),
    useGupy: z.boolean(),
    useCompanyBoards: z.boolean(),
    extraBoards: z
      .array(z.string().refine((value) => parseBoardInput(value) !== null, "Link de página de vagas não reconhecido."))
      .max(20, "Use no máximo 20 páginas."),
    autoSearch: z.boolean(),
  })
  .refine((values) => values.useGupy || values.useCompanyBoards || values.extraBoards.length > 0, {
    message: "Escolha pelo menos uma fonte de vagas.",
    path: ["useGupy"],
  });

export type JobProfileFormValues = z.infer<typeof jobProfileFormSchema>;
type JobProfileRow = Tables<"job_profiles">;

export const emptyJobProfileFormValues: JobProfileFormValues = {
  roles: [],
  jobTypes: ["estagio"],
  workModels: ["presencial", "hibrido", "remoto"],
  city: "",
  state: "",
  minSalary: "",
  keywords: [],
  excludedWords: [],
  useGupy: true,
  useCompanyBoards: true,
  extraBoards: [],
  autoSearch: true,
};

/** Remove repetidos sem diferenciar maiúsculas ("SQL" e "sql"). */
function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toJobProfilePayload(values: JobProfileFormValues): Omit<TablesInsert<"job_profiles">, "user_id"> {
  return {
    roles: unique(values.roles.map((role) => role.trim())),
    job_types: [...new Set(values.jobTypes)],
    work_models: [...new Set(values.workModels)],
    city: values.city.trim() || null,
    state: values.state || null,
    min_salary_cents: values.minSalary.trim() === "" ? null : parseBRLToCents(values.minSalary),
    keywords: unique(values.keywords.map((keyword) => keyword.trim())),
    excluded_words: unique(values.excludedWords.map((word) => word.trim())),
    use_gupy: values.useGupy,
    use_company_boards: values.useCompanyBoards,
    extra_boards: unique(
      values.extraBoards.map((value) => parseBoardInput(value)).filter((board) => board !== null).map(boardKey),
    ),
    auto_search: values.autoSearch,
  };
}

export function toJobProfileFormValues(row: JobProfileRow): JobProfileFormValues {
  return {
    roles: row.roles,
    jobTypes: row.job_types,
    workModels: row.work_models,
    city: row.city ?? "",
    state: (row.state ?? "") as JobProfileFormValues["state"],
    minSalary: centsToInput(row.min_salary_cents),
    keywords: row.keywords,
    excludedWords: row.excluded_words,
    useGupy: row.use_gupy,
    useCompanyBoards: row.use_company_boards,
    extraBoards: row.extra_boards,
    autoSearch: row.auto_search,
  };
}

/** Converte a linha do banco no formato usado pela busca. */
export function toSearchProfile(row: JobProfileRow): SearchProfile {
  return {
    roles: row.roles,
    keywords: row.keywords,
    excludedWords: row.excluded_words,
    city: row.city,
    state: row.state,
    workModels: row.work_models,
    jobTypes: row.job_types,
    minSalaryCents: row.min_salary_cents,
    useGupy: row.use_gupy,
    useCompanyBoards: row.use_company_boards,
    extraBoards: row.extra_boards.map((value) => parseBoardInput(value)).filter((board): board is BoardRef => board !== null),
  };
}

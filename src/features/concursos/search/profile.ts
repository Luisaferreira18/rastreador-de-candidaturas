import { z } from "zod";
import { UF_VALUES, isUF } from "@/features/job-search/brazil";
import { EDUCATION_VALUES, SPHERE_VALUES } from "@/lib/concurso-options";
import { centsToInput, parseBRLToCents } from "@/lib/format";
import type { Tables, TablesInsert } from "@/types/database";
import type { ConcursoSearchProfile } from "./types";

type ProfileRow = Tables<"concurso_profiles">;

const tag = (max: number) => z.string().trim().min(2, "Use pelo menos 2 letras.").max(max, `Use no máximo ${max} caracteres.`);

/** "Belo Horizonte/MG", "belo horizonte - mg" → "Belo Horizonte/MG" (ou null se não tiver estado válido). */
export function normalizePlace(value: string): string | null {
  const match = /^\s*(.+?)\s*[/,–-]\s*([A-Za-z]{2})\s*$/.exec(value);
  if (!match || !isUF(match[2].toUpperCase())) return null;
  const city = match[1]
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase())
    .replace(/\s(D[aeo]s?)\s/g, (word) => word.toLowerCase());
  return `${city}/${match[2].toUpperCase()}`;
}

export const concursoProfileFormSchema = z.object({
  education: z.enum(EDUCATION_VALUES, { error: "Escolha a sua escolaridade." }),
  roles: z.array(tag(60)).max(10, "Use no máximo 10 cargos."),
  areas: z.array(tag(40)).max(10, "Use no máximo 10 áreas."),
  spheres: z.array(z.enum(SPHERE_VALUES)).min(1, "Escolha pelo menos uma esfera."),
  cities: z
    .array(z.string().refine((value) => normalizePlace(value) !== null, "Use o formato Cidade/UF, como Belo Horizonte/MG."))
    .max(10, "Use no máximo 10 cidades."),
  states: z.array(z.enum(UF_VALUES, { error: "Estado inválido." })).max(27),
  minSalary: z
    .string()
    .trim()
    .refine((value) => value === "" || parseBRLToCents(value) !== null, { message: "Valor inválido. Use o formato 4.000,00." }),
  examBoards: z.array(tag(40)).max(10, "Use no máximo 10 bancas."),
  acceptsRelocation: z.boolean(),
  autoSearch: z.boolean(),
});

export type ConcursoProfileFormValues = z.infer<typeof concursoProfileFormSchema>;

export const emptyConcursoProfileFormValues: ConcursoProfileFormValues = {
  education: "superior",
  roles: [],
  areas: [],
  spheres: ["federal", "estadual", "municipal"],
  cities: [],
  states: [],
  minSalary: "",
  examBoards: [],
  acceptsRelocation: false,
  autoSearch: true,
};

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function toConcursoProfilePayload(values: ConcursoProfileFormValues): Omit<TablesInsert<"concurso_profiles">, "user_id"> {
  return {
    education: values.education,
    roles: unique(values.roles.map((role) => role.trim())),
    areas: unique(values.areas.map((area) => area.trim())),
    spheres: [...new Set(values.spheres)],
    cities: unique(values.cities.map((city) => normalizePlace(city)!).filter(Boolean)),
    states: [...new Set(values.states)],
    min_salary_cents: values.minSalary.trim() === "" ? null : parseBRLToCents(values.minSalary),
    exam_boards: unique(values.examBoards.map((board) => board.trim())),
    accepts_relocation: values.acceptsRelocation,
    auto_search: values.autoSearch,
  };
}

export function toConcursoProfileFormValues(row: ProfileRow): ConcursoProfileFormValues {
  return {
    education: row.education,
    roles: row.roles,
    areas: row.areas,
    spheres: row.spheres,
    cities: row.cities,
    states: row.states as ConcursoProfileFormValues["states"],
    minSalary: centsToInput(row.min_salary_cents),
    examBoards: row.exam_boards,
    acceptsRelocation: row.accepts_relocation,
    autoSearch: row.auto_search,
  };
}

/** As colunas do perfil que a nota usa. */
export type ConcursoProfileCriteria = Pick<
  ProfileRow,
  "education" | "areas" | "roles" | "spheres" | "cities" | "states" | "min_salary_cents" | "exam_boards" | "accepts_relocation"
>;

export function toConcursoSearchProfile(row: ConcursoProfileCriteria): ConcursoSearchProfile {
  return {
    education: row.education,
    areas: row.areas,
    roles: row.roles,
    spheres: row.spheres,
    cities: row.cities,
    states: row.states,
    minSalaryCents: row.min_salary_cents,
    examBoards: row.exam_boards,
    acceptsRelocation: row.accepts_relocation,
  };
}

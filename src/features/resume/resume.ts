/**
 * O currículo no banco: onde o arquivo fica e como o que foi lido vira linha
 * da tabela `resumes` (e volta).
 */

import type { Json, Tables, TablesInsert } from "@/types/database";
import { LANGUAGE_LEVELS, type LanguageLevel, type ResumeExtraction, type ResumeLanguage } from "./extract";

export type Resume = Tables<"resumes">;

/** Resposta de POST /api/curriculo. */
export type ResumeUploadResponse = { status: "ok"; resume: Resume } | { status: "erro"; message: string };

/** Bucket privado do Storage. */
export const RESUME_BUCKET = "curriculos";
/** 4 MB: a Vercel aceita até 4,5 MB por requisição. */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;

export const DEMO_RESUME_MESSAGE =
  "Na demonstração, o envio de currículo fica desligado: a conta é compartilhada e qualquer visitante veria o arquivo.";

/** Um currículo por pessoa, sempre no mesmo lugar. */
export function resumePath(userId: string): string {
  return `${userId}/curriculo.pdf`;
}

/** Nome do arquivo para mostrar na tela (sem pastas, no máximo 200 caracteres). */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() || "curriculo.pdf";
  return base.slice(0, 200);
}

export function toResumeRow(
  userId: string,
  file: { name: string; size: number },
  extraction: ResumeExtraction,
): TablesInsert<"resumes"> {
  return {
    user_id: userId,
    file_path: resumePath(userId),
    file_name: cleanFileName(file.name),
    file_size: file.size,
    skills: extraction.skills,
    languages: extraction.languages as unknown as Json,
    course: extraction.course,
    education_status: extraction.educationStatus,
    graduation_year: extraction.graduationYear,
    city: extraction.city?.slice(0, 80) ?? null,
    state: extraction.state,
    suggested_roles: extraction.roles,
    suggested_job_types: extraction.jobTypes,
    uploaded_at: new Date().toISOString(),
  };
}

/** Lê a coluna `languages` com tolerância a formatos inesperados. */
export function parseLanguages(value: Json): ResumeLanguage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { name, level } = item as Record<string, unknown>;
    if (typeof name !== "string" || !name) return [];
    const known = LANGUAGE_LEVELS.includes(level as LanguageLevel) ? (level as LanguageLevel) : null;
    return [{ name, level: known }];
  });
}

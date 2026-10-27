import { topPosition } from "@/features/board/board-state";
import type { JobType } from "@/lib/options";
import type { Tables, TablesInsert } from "@/types/database";
import { SOURCE_LABELS } from "./types";

export type JobLead = Tables<"job_leads">;

/**
 * Candidatura criada a partir de uma vaga sugerida, já em "Quero me candidatar".
 * Sem tipo informado pela fonte, usa o primeiro tipo do perfil.
 */
export function leadToApplication(
  lead: JobLead,
  profileJobTypes: readonly JobType[],
): Omit<TablesInsert<"applications">, "user_id"> {
  const notes = [
    `Encontrada pelo caça-vagas (${lead.score}% compatível, ${SOURCE_LABELS[lead.source]}).`,
    lead.reasons.length > 0 ? `Por quê: ${lead.reasons.join(" · ")}.` : null,
    lead.deadline ? `Inscrições até ${lead.deadline.split("-").reverse().join("/")}.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    company: lead.company.slice(0, 120),
    role_title: lead.title.slice(0, 160),
    job_type: lead.job_type ?? profileJobTypes[0] ?? "clt",
    job_url: lead.url,
    platform: lead.source === "gupy" ? "gupy" : "site_empresa",
    location: lead.location?.slice(0, 120) ?? null,
    work_model: lead.work_model ?? "presencial",
    salary_cents: lead.salary_cents,
    stage: "quero_candidatar",
    priority: lead.score >= 85 ? "alta" : "media",
    notes,
    position: topPosition(),
  };
}

/** Faixa da nota, para a cor da etiqueta. */
export function scoreTone(score: number): "alta" | "boa" | "media" {
  if (score >= 85) return "alta";
  if (score >= 70) return "boa";
  return "media";
}

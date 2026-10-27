/**
 * Gupy: a mesma busca pública que o portal de vagas (portal.gupy.io) usa no
 * navegador, sem login. Não é uma API oficial: se a Gupy mudar o formato, a
 * busca registra o erro e as outras fontes continuam funcionando.
 */

import type { WorkModel } from "@/lib/options";
import { stateName, toUF } from "../brazil";
import { gupyJobType, gupyTypesFor } from "../classify";
import { fold, searchTerms, stripHtml } from "../text";
import type { ScrapedJob, SearchProfile } from "../types";
import { SourceError } from "./http";

const ENDPOINT = "https://portal.gupy.io/api/job-search/jobs";
/** Vagas por consulta (a Gupy aceita até 100). */
const PAGE_SIZE = 50;

type GupyJob = {
  id?: number | string;
  name?: string;
  description?: string;
  careerPageName?: string;
  type?: string;
  publishedDate?: string;
  applicationDeadline?: string | null;
  workplaceType?: string;
  city?: string;
  state?: string;
  country?: string;
  jobUrl?: string;
};

const WORKPLACE: Record<string, WorkModel> = { remote: "remoto", hybrid: "hibrido", "on-site": "presencial" };

/**
 * As consultas para um perfil: uma por cargo, filtrando pelos tipos de vaga.
 * Com estado definido, uma consulta para o estado (presencial e híbrido) e
 * outra para vagas remotas do país inteiro.
 */
export function gupyQueryUrls(profile: SearchProfile): string[] {
  const types = gupyTypesFor(profile.jobTypes);
  const onSite = profile.workModels.includes("presencial") || profile.workModels.includes("hibrido");
  const remote = profile.workModels.includes("remoto");
  const state = profile.state ? stateName(profile.state) : null;
  const urls: string[] = [];

  for (const role of profile.roles) {
    const term = searchTerms(role) || fold(role).trim();
    if (!term) continue;
    const base = new URLSearchParams({ jobName: term, limit: String(PAGE_SIZE), offset: "0" });
    if (types.length > 0) base.set("type", types.join(","));

    const withParams = (extra: Record<string, string>) => {
      const params = new URLSearchParams(base);
      for (const [key, value] of Object.entries(extra)) params.set(key, value);
      return `${ENDPOINT}?${params}`;
    };
    if (onSite && state) urls.push(withParams({ state }));
    if (onSite && !state) urls.push(withParams({}));
    if (remote && (state || !onSite)) urls.push(withParams({ workplaceType: "remote" }));
  }
  return [...new Set(urls)];
}

/** "Estágio Vertem" → "Vertem"; slogans viram o nome do endereço da página. */
export function gupyCompanyName(careerPageName: string | undefined, jobUrl: string | undefined): string {
  // Sem emojis ("KOVI ❤️" → "KOVI").
  let name = (careerPageName ?? "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  name = name
    // "2027 - Grupo Solví" → "Grupo Solví"
    .replace(/^20\d\d\s*[-|–:]\s*/, "")
    .replace(
      /^(?:programa\s+de\s+)?(?:est[aá]gios?|trainee|vagas|carreiras?|oportunidades|trabalhe\s+(?:conosco|na|no))\s+(?:(?:na|no|da|do|de|-)\s+)?/i,
      "",
    );
  // "Instituto Infnet - Venha ser estagiário ou trainee!" → "Instituto Infnet"
  // "Youse Seguros | Programa de Estágio 2026" → "Youse Seguros"
  const [first, ...rest] = name.split(/\s+[-|–]\s+/);
  if (
    rest.length > 0 &&
    /[!?]|\b(venha|vem|junte|faca parte|seja|trabalhe|programa|estagio|estagios|trainee|vagas|carreiras?|oportunidades|20\d\d)\b/.test(
      fold(rest.join(" ")),
    )
  ) {
    name = first;
  }

  const looksLikeSlogan = /[!?]/.test(name) || /^(venha|vem|trabalhe|junte|faca parte|seja|construa|bora|vamos)\b/.test(fold(name));
  if (name && !looksLikeSlogan) return name.slice(0, 120);

  try {
    const subdomain = new URL(jobUrl ?? "").hostname.split(".")[0];
    const cleaned = subdomain.replace(/^(vagas|carreiras|carreira|estagio|trabalhe)-|-(vagas|carreiras|estagio)$/g, "");
    if (cleaned) return cleaned.replace(/-/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()).slice(0, 120);
  } catch {
    // sem endereço válido
  }
  return "Empresa na Gupy";
}

export function normalizeGupyJob(job: GupyJob): ScrapedJob | null {
  if (job.id === undefined || !job.name || !job.jobUrl?.startsWith("https://")) return null;
  const { jobType, otherType } = gupyJobType(job.type);
  const uf = toUF(job.state);
  const city = job.city?.trim() || null;
  const workModel = job.workplaceType ? (WORKPLACE[job.workplaceType] ?? null) : null;
  return {
    source: "gupy",
    externalId: String(job.id),
    company: gupyCompanyName(job.careerPageName, job.jobUrl),
    title: job.name.trim().slice(0, 200),
    url: job.jobUrl,
    location: workModel === "remoto" && !city ? "Remoto" : [city, uf].filter(Boolean).join(", ") || null,
    city,
    state: uf,
    workModel,
    jobType,
    otherType,
    country: job.country ? (fold(job.country).startsWith("bra") ? "BR" : job.country) : null,
    salaryCents: null,
    publishedAt: job.publishedDate ?? null,
    deadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : null,
    text: stripHtml(job.description ?? "").slice(0, 6000),
  };
}

export function parseGupyResponse(json: unknown): ScrapedJob[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new SourceError("respondeu num formato inesperado");
  return data.map((job) => normalizeGupyJob(job as GupyJob)).filter((job): job is ScrapedJob => job !== null);
}

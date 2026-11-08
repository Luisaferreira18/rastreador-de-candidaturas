/**
 * Alertas de vagas do LinkedIn que chegam no Gmail da própria pessoa. O app lê
 * só o e-mail, sem acessar o site do LinkedIn (que proíbe a coleta automática).
 *
 * O e-mail traz cargo, empresa, local e link, mas não a descrição: dá para
 * filtrar por cargo, tipo e cidade, não por formação nem experiência. Por isso
 * toda vaga daqui vem com um aviso.
 *
 * A leitura se apoia no link da vaga, que é o mais estável: o texto ao redor
 * pode mudar de idioma e de formato sem aviso.
 */

import type { Json, Tables } from "@/types/database";
import { detectJobType, detectOtherType, detectWorkModel } from "./classify";
import { toSearchProfile } from "./profile";
import { MAX_NEW_PER_RUN, buildSkipCheck, rankJobs } from "./search";
import { fold } from "./text";
import type { ScrapedJob } from "./types";

export const NO_DESCRIPTION_WARNING = "Requisitos não conferidos: o alerta do LinkedIn não traz a descrição";

/** Até o fim do endereço: "jobalerts@linkedin.com.exemplo.net" não é o LinkedIn. */
const ALERT_SENDER = /(?:^|[<\s])(?:jobalerts|jobs-listings)[\w.-]*@(?:[\w-]+\.)*linkedin\.com(?=>|\s|$)/i;
/** O script envia até 8 mil caracteres de cada e-mail. */
const BODY_LIMIT = 8000;
const JOB_LINK = /https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^\s/?]*-)?(\d{6,})[^\s<>)]*/gi;

/** Linhas que acompanham a vaga, mas não são cargo, empresa nem local. */
const NOT_JOB_DATA = [
  /^[-=_*·•\s]*$/,
  /^(?:ver vaga|view job|see job|candidat[ae]-se|apply)\b/,
  /^(?:candidatura simplificada|easy apply)\b/,
  /^(?:promovida|promoted|patrocinada|sponsored)\b/,
  /recrutando ativamente|actively (?:recruiting|hiring)|seja um dos primeiros|be an early applicant|early applicant/,
  /\bconex(?:ao|oes)\b|\bconnections?\b|\balumni\b|ex-alun/,
  /^(?:r\$|us\$|\$)/,
  /alerta de vagas?|job alert|novas? vagas?|new jobs?|\d+ vagas?|\d+ jobs?|vagas? (?:que )?corresponde|match your preferences/,
  /^(?:ver todas|see all|confira|gerenciar|manage|cancelar|unsubscribe)\b/,
];

function isJobData(line: string): boolean {
  const value = fold(line);
  return !NOT_JOB_DATA.some((pattern) => pattern.test(value));
}

export function isLinkedinAlert(from: string | null | undefined): boolean {
  return ALERT_SENDER.test(from ?? "");
}

/** Cargo, empresa e local: as últimas linhas antes do link. */
function readBlock(block: string): { title: string; company: string; location: string | null } | null {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(isJobData);
  if (lines.length >= 3) {
    const [title, company, location] = lines.slice(-3);
    return { title, company, location };
  }
  if (lines.length < 2) return null;
  // "Empresa · São Paulo, Brasil" na mesma linha.
  const [title, rest] = lines;
  const [company, location] = rest.split(/\s+[·•|]\s+/, 2);
  return { title, company, location: location ?? null };
}

/** As vagas de um alerta, sem repetir e sem os parâmetros de rastreamento do link. */
export function parseLinkedinAlert(body: string): ScrapedJob[] {
  const jobs = new Map<string, ScrapedJob>();
  let blockStart = 0;
  for (const match of body.matchAll(JOB_LINK)) {
    const id = match[1];
    const end = match.index + match[0].length;
    const block = body.slice(blockStart, match.index);
    blockStart = end;
    // No limite do script, o último link pode vir pela metade, com o número errado.
    const cut = end >= body.length && body.length >= BODY_LIMIT;
    if (cut || jobs.has(id)) continue;
    const read = readBlock(block);
    if (!read) continue;

    const place = read.location ?? "";
    const titleAndPlace = `${read.title} ${place}`;
    jobs.set(id, {
      source: "linkedin",
      externalId: id,
      company: read.company.slice(0, 120),
      title: read.title.slice(0, 200),
      url: `https://www.linkedin.com/jobs/view/${id}/`,
      location: read.location?.slice(0, 200) ?? null,
      state: null,
      city: null,
      workModel: detectWorkModel(titleAndPlace),
      jobType: detectJobType(read.title),
      otherType: detectOtherType(read.title),
      country: null,
      salaryCents: null,
      publishedAt: null,
      deadline: null,
      benefits: [],
      workload: null,
      detailUrl: null,
      text: "",
    });
  }
  return [...jobs.values()];
}

/** O que a função job_alert_context do banco devolve para o dono do token. */
export type JobAlertContext = {
  profile: Pick<
    Tables<"job_profiles">,
    "roles" | "keywords" | "excluded_words" | "city" | "state" | "work_models" | "job_types" | "min_salary_cents" | "auto_search"
  >;
  resume: Pick<Tables<"resumes">, "skills" | "languages" | "course" | "education_status" | "graduation_year" | "experience_months"> | null;
  applications: { company: string; role_title: string; job_url: string | null }[];
  leads: { source: string; external_id: string; company: string; title: string; url: string }[];
};

export type JobAlertLead = {
  external_id: string;
  company: string;
  title: string;
  url: string;
  location: string | null;
  work_model: string | null;
  job_type: string | null;
  score: number;
  reasons: string[];
  warnings: string[];
};

/** As vagas dos alertas que viram sugestão, com as mesmas regras da busca diária. */
export function selectAlertLeads(jobs: readonly ScrapedJob[], context: JobAlertContext, today: string): JobAlertLead[] {
  if (!context.profile.auto_search) return [];
  const profile = toSearchProfile(
    { ...context.profile, use_gupy: false, use_company_boards: false, extra_boards: [] } as unknown as Tables<"job_profiles">,
    context.resume,
  );
  // A mesma vaga pode ter vindo antes por outra fonte: a empresa e o cargo também contam.
  const skip = buildSkipCheck(context.leads, [
    ...context.applications,
    ...context.leads.map((lead) => ({ company: lead.company, role_title: lead.title, job_url: lead.url })),
  ]);
  return rankJobs(jobs, profile, today)
    .filter((job) => !skip(job))
    .slice(0, MAX_NEW_PER_RUN)
    .map((job) => ({
      external_id: job.externalId,
      company: job.company,
      title: job.title,
      url: job.url,
      location: job.location,
      work_model: job.workModel,
      job_type: job.jobType,
      score: job.score,
      reasons: job.reasons.slice(0, 9),
      warnings: [NO_DESCRIPTION_WARNING, ...job.warnings].slice(0, 10),
    }));
}

export type JobAlertClient = {
  rpc(
    name: "job_alert_context" | "job_alert_ingest",
    args: { p_token: string; p_leads?: Json },
  ): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export class InvalidTokenError extends Error {}

/** As vagas de todos os alertas de um lote de e-mails. */
export function alertJobs(emails: readonly { from?: string | null; body: string }[]): ScrapedJob[] {
  return emails.filter((email) => isLinkedinAlert(email.from)).flatMap((email) => parseLinkedinAlert(email.body));
}

/**
 * Grava as vagas novas dos alertas e devolve quantas foram gravadas. Um problema
 * aqui não atrapalha as sugestões da caixa de entrada: só o token inválido
 * interrompe.
 */
export async function ingestJobAlerts(
  client: JobAlertClient,
  token: string,
  jobs: readonly ScrapedJob[],
  today: string,
): Promise<number> {
  const context = await client.rpc("job_alert_context", { p_token: token });
  if (context.error?.code === "28000") throw new InvalidTokenError();
  if (context.error) {
    console.error("[inbox/email] alertas", context.error);
    return 0;
  }
  if (!context.data) return 0;

  const leads = selectAlertLeads(jobs, context.data as JobAlertContext, today);
  if (leads.length === 0) return 0;

  const saved = await client.rpc("job_alert_ingest", { p_token: token, p_leads: leads as unknown as Json });
  if (saved.error) {
    console.error("[inbox/email] alertas", saved.error);
    return 0;
  }
  return Number(saved.data ?? 0);
}

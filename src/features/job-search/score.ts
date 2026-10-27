/**
 * Nota de compatibilidade (0 a 100) entre uma vaga e o perfil, por regras
 * simples e explicáveis: cada ponto vira um motivo que a pessoa vê na tela.
 *
 *   Cargo 45 · Tipo de vaga 20 · Local e modelo 20 · Palavras-chave 15
 *
 * Vagas que claramente não servem (outro tipo, nível sênior, outra cidade,
 * fora do Brasil, palavra a evitar) ficam de fora em vez de ganhar nota baixa.
 */

import { formatCurrency } from "@/lib/format";
import { jobTypeLabel, workModelLabel, type JobType } from "@/lib/options";
import { findCities, findUFs, findUFsInTitle, isBrazilLocation } from "./brazil";
import { detectSeniority, type Seniority } from "./classify";
import { containsTerm, coreTerms, fold } from "./text";
import type { JobMatch, ScrapedJob, SearchProfile } from "./types";

/** Abaixo desta nota a vaga não vira sugestão. */
export const MIN_SCORE = 60;

const WEIGHTS = { role: 45, type: 20, place: 20, keywords: 15 } as const;
/** Desconto quando a remuneração informada fica abaixo do mínimo do perfil. */
const LOW_SALARY_PENALTY = 15;

const EARLY_CAREER: readonly JobType[] = ["estagio", "trainee"];
const LEVEL_LABEL: Record<Exclude<Seniority, null>, string> = {
  junior: "júnior",
  pleno: "pleno",
  senior: "sênior",
  lideranca: "liderança",
};

const excluded = (reason: string): JobMatch => ({ excluded: true, reason });

/** Quanto do cargo procurado aparece no título (0 a 1), e qual cargo bateu melhor. */
export function roleMatch(title: string, roles: readonly string[]): { fraction: number; role: string | null } {
  const titleTerms = new Set(coreTerms(title));
  let best = { fraction: 0, hits: 0, role: null as string | null };
  for (const role of roles) {
    const terms = coreTerms(role);
    const hits = terms.filter((term) => titleTerms.has(term)).length;
    // Cargo só com o nível ("Estágio"): qualquer área serve.
    const fraction = terms.length === 0 ? 1 : hits / terms.length;
    // No empate, vale o cargo com mais palavras em comum ("Análise de Dados" > "Dados").
    if (fraction > best.fraction || (fraction === best.fraction && fraction > 0 && hits > best.hits)) {
      best = { fraction, hits, role };
    }
  }
  return { fraction: best.fraction, role: best.role };
}

type PlaceResult = { excluded: string } | { score: number; reason: string | null };

function placeLabel(job: ScrapedJob): string | null {
  if (job.city) return job.state ? `${job.city}, ${job.state}` : job.city;
  return job.location ? job.location.slice(0, 40) : null;
}

/** Local e modelo de trabalho. */
export function placeMatch(job: ScrapedJob, profile: SearchProfile): PlaceResult {
  if (isBrazilLocation(job.location, job.country) === false) return { excluded: "Vaga fora do Brasil" };

  const model = job.workModel;
  if (model && !profile.workModels.includes(model)) return { excluded: `Vaga ${workModelLabel(model).toLowerCase()}` };
  if (model === "remoto") return { score: 1, reason: "Remoto" };

  const where = placeLabel(job);
  const describe = (place: string | null) =>
    model ? `${workModelLabel(model)}${place ? ` em ${place}` : ""}` : place ? `Em ${place}` : null;

  // Sem cidade nem estado no perfil: qualquer lugar do Brasil serve.
  if (!profile.city && !profile.state) return { score: 1, reason: describe(where) };

  const placeText = [job.location, job.city].filter(Boolean).join(" ");
  const cityMatch = profile.city
    ? job.city
      ? fold(job.city) === fold(profile.city)
      : containsTerm(fold(`${placeText} ${job.title}`), profile.city)
    : false;
  if (cityMatch) return { score: 1, reason: describe(where ?? profile.city) };

  const ufs = new Set([...(job.state ? [job.state] : []), ...findUFs(placeText), ...findUFsInTitle(job.title)]);
  if (profile.state && ufs.has(profile.state)) {
    // Mesmo estado, outra cidade: vale menos para quem informou a cidade.
    return { score: profile.city ? 0.6 : 1, reason: describe(where ?? profile.state) };
  }

  const placeKnown = ufs.size > 0 || findCities(placeText).length > 0;
  if (placeKnown) return { excluded: "Em outra cidade" };

  // Local não informado ("Brasil", "Remote"): pode servir, mas sem certeza.
  return { score: profile.workModels.includes("remoto") ? 0.5 : 0.3, reason: null };
}

export function scoreJob(job: ScrapedJob, profile: SearchProfile, today: string): JobMatch {
  const title = job.title;
  const foldedTitle = fold(title);

  if (job.deadline && job.deadline < today) return excluded("Inscrições encerradas");
  const avoided = profile.excludedWords.find((word) => containsTerm(foldedTitle, word));
  if (avoided) return excluded(`Título com "${avoided}"`);
  if (job.otherType) return excluded(job.otherType);

  // Cargo
  const role = roleMatch(title, profile.roles);
  if (role.fraction === 0 || !role.role) return excluded("Cargo diferente do perfil");

  // Tipo de vaga e nível
  const earlyCareerOnly = profile.jobTypes.every((type) => EARLY_CAREER.includes(type));
  let typeScore: number;
  if (job.jobType) {
    if (!profile.jobTypes.includes(job.jobType)) return excluded(`Vaga de ${jobTypeLabel(job.jobType)}`);
    typeScore = 1;
  } else {
    // Estágio e trainee quase sempre dizem isso no título; sem isso, não é.
    if (earlyCareerOnly) return excluded("Não diz que é estágio ou trainee");
    typeScore = 0.5;
  }
  if (!job.jobType || !EARLY_CAREER.includes(job.jobType)) {
    const level = detectSeniority(title);
    const wanted = new Set(profile.roles.map(detectSeniority));
    if (level && level !== "junior" && !wanted.has(level)) return excluded(`Vaga de nível ${LEVEL_LABEL[level]}`);
  }

  // Local e modelo
  const place = placeMatch(job, profile);
  if ("excluded" in place) return excluded(place.excluded);

  // Palavras-chave do currículo
  const haystack = fold(`${title} ${job.text}`);
  const foundKeywords = profile.keywords.filter((keyword) => containsTerm(haystack, keyword));
  const keywordScore =
    profile.keywords.length > 0 ? Math.min(1, foundKeywords.length / Math.min(3, profile.keywords.length)) : 0;

  // Remuneração (só quando a fonte informa)
  const lowSalary =
    job.salaryCents !== null && profile.minSalaryCents !== null && job.salaryCents < profile.minSalaryCents;
  const penalty = lowSalary ? LOW_SALARY_PENALTY : 0;

  const reasons = [
    role.fraction === 1 ? `Cargo: ${role.role}` : `Cargo parecido: ${role.role}`,
    job.jobType && jobTypeLabel(job.jobType),
    place.reason,
    foundKeywords.length > 0 && foundKeywords.slice(0, 4).join(", "),
    job.salaryCents !== null && !lowSalary && formatCurrency(job.salaryCents),
  ].filter((reason): reason is string => typeof reason === "string" && reason !== "");
  const warnings = lowSalary ? [`${formatCurrency(job.salaryCents)}: abaixo do seu mínimo`] : [];

  const total = WEIGHTS.role + WEIGHTS.type + WEIGHTS.place + (profile.keywords.length > 0 ? WEIGHTS.keywords : 0);
  const earned =
    WEIGHTS.role * role.fraction +
    WEIGHTS.type * typeScore +
    WEIGHTS.place * place.score +
    (profile.keywords.length > 0 ? WEIGHTS.keywords * keywordScore : 0);
  const score = Math.max(0, Math.min(100, Math.round((earned / total) * 100) - penalty));

  return { excluded: false, score, reasons, warnings };
}

/**
 * Nota de compatibilidade (0 a 100) entre um edital e o perfil de concursos,
 * por regras simples e explicáveis, no estilo da nota das vagas:
 *
 *   Cargo e área 40 · Escolaridade 20 · Local 20 · Salário 10 · Banca 10
 *
 * Ficam de fora, em vez de ganhar nota baixa: inscrições encerradas, esfera
 * fora do perfil, escolaridade acima da pessoa e outra cidade ou estado (para
 * quem não aceita mudar).
 */

import { educationRank, sphereLabel } from "@/lib/concurso-options";
import { formatCurrencyCompact, formatDayCount } from "@/lib/format";
import { daysUntil } from "../schedule";
import type { CatalogNotice, ConcursoSearchProfile, NoticeMatch } from "./types";

export const MIN_CONCURSO_SCORE = 55;
const WEIGHTS = { role: 40, education: 20, place: 20, salary: 10, board: 10 } as const;

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Áreas com os jeitos de aparecer no nome do cargo. */
const AREA_SYNONYMS: Record<string, string[]> = {
  ti: ["ti", "tic", "tecnologia da informacao", "informatica", "sistemas", "software", "infraestrutura", "redes", "suporte", "dados", "seguranca da informacao", "desenvolvimento"],
  tecnologia: ["ti", "tic", "tecnologia da informacao", "informatica", "sistemas", "software", "dados"],
  dados: ["dados", "ciencia de dados", "estatistica", "analise de dados", "bi"],
  administrativa: ["administrativ", "administracao", "gestao", "secretari"],
  juridica: ["juridic", "direito", "judiciaria", "procurador", "advog"],
  saude: ["saude", "enfermag", "medic", "farmac", "nutri", "fisioter", "odonto", "psicolog"],
  educacao: ["professor", "docente", "magisterio", "educacao", "pedagog", "ensino"],
  contabil: ["contab", "contador", "financ", "auditor", "controle", "economista"],
  engenharia: ["engenh", "arquitet"],
  seguranca: ["policia", "policial", "guarda", "seguranca publica", "agente penitenciario", "bombeiro"],
};

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Prefixo de palavra ("administrativ" acha "administrativa"); siglas curtas, palavra inteira.
  const ending = needle.length <= 3 ? "(?![a-z0-9])" : "";
  return new RegExp(`(?<![a-z0-9])${escaped}${ending}`).test(haystack);
}

function areaMatches(title: string, area: string): boolean {
  const key = fold(area).trim();
  const terms = AREA_SYNONYMS[key] ?? [key];
  return terms.some((term) => containsWord(title, term));
}

function roleMatches(title: string, role: string): boolean {
  const words = fold(role).split(/\s+/).filter((word) => word.length >= 2);
  return words.length > 0 && words.every((word) => containsWord(title, word.length > 5 ? word.slice(0, -1) : word));
}

/** O cargo do edital que mais combina com o perfil, e quanto combina (0 a 1). */
export function bestRole(notice: CatalogNotice, profile: ConcursoSearchProfile) {
  const candidates = notice.roles.length > 0 ? notice.roles : [{ title: notice.title ?? notice.organ, education: null }];
  let best = { role: candidates[0], fraction: 0, matchedRole: false, matchedArea: false };
  for (const candidate of candidates) {
    const title = fold(candidate.title);
    const matchedRole = profile.roles.some((role) => roleMatches(title, role));
    const matchedArea = profile.areas.some((area) => areaMatches(title, area));
    const parts = [profile.roles.length > 0 ? matchedRole : null, profile.areas.length > 0 ? matchedArea : null].filter(
      (part): part is boolean => part !== null,
    );
    const fraction = parts.length === 0 ? 0.5 : parts.filter(Boolean).length / parts.length;
    if (fraction > best.fraction) best = { role: candidate, fraction, matchedRole, matchedArea };
  }
  return best;
}

const placeOf = (city: string) => {
  const [name, uf] = city.split("/").map((part) => part.trim());
  return { name: fold(name), uf: uf?.toUpperCase() ?? null };
};

/** Local: a cidade da vaga (municipal/estadual) contra as cidades e os estados do perfil. */
function placeScore(notice: CatalogNotice, profile: ConcursoSearchProfile): { excluded: string } | { score: number; reason: string } {
  if (notice.sphere === "federal" || (!notice.city && !notice.state)) {
    return { score: 0.8, reason: notice.sphere ? sphereLabel(notice.sphere) : "Local não informado" };
  }
  const cities = profile.cities.map(placeOf);
  const states = new Set([...profile.states, ...cities.flatMap((city) => (city.uf ? [city.uf] : []))]);
  const where = [notice.city, notice.state].filter(Boolean).join("/");
  if (cities.length === 0 && states.size === 0) return { score: 0.7, reason: where };

  if (notice.city && cities.some((city) => city.name === fold(notice.city!) && (!city.uf || city.uf === notice.state))) {
    return { score: 1, reason: where };
  }
  if (notice.state && states.has(notice.state)) {
    if (cities.length === 0) return { score: 1, reason: where };
    if (profile.acceptsRelocation) return { score: 0.6, reason: `${where} (aceita mudar)` };
    return { excluded: "Em outra cidade" };
  }
  return profile.acceptsRelocation ? { score: 0.3, reason: `${where} (aceita mudar)` } : { excluded: "Em outro estado" };
}

export function scoreNotice(notice: CatalogNotice, profile: ConcursoSearchProfile, today: string): NoticeMatch {
  // Inscrições
  const ends = notice.dates.filter((item) => item.kind === "inscricao_fim").map((item) => item.date).sort();
  const registrationEnd = ends[ends.length - 1] ?? null;
  if (registrationEnd && registrationEnd < today) return { excluded: true, reason: "Inscrições encerradas" };

  if (notice.sphere && !profile.spheres.includes(notice.sphere)) {
    return { excluded: true, reason: `Concurso ${sphereLabel(notice.sphere).toLowerCase()}` };
  }

  const role = bestRole(notice, profile);
  if ((profile.roles.length > 0 || profile.areas.length > 0) && role.fraction === 0) {
    return { excluded: true, reason: "Cargo fora do perfil" };
  }

  const education = role.role.education;
  if (education && educationRank(education) > educationRank(profile.education)) {
    return { excluded: true, reason: education === "superior" ? "Exige nível superior" : "Exige escolaridade maior" };
  }

  const place = placeScore(notice, profile);
  if ("excluded" in place) return { excluded: true, reason: place.excluded };

  const warnings: string[] = [];
  let salaryScore = 0.5;
  let salaryReason: string | null = null;
  if (notice.salaryCents !== null) {
    if (profile.minSalaryCents !== null && notice.salaryCents < profile.minSalaryCents) {
      salaryScore = 0;
      warnings.push(`Salário de ${formatCurrencyCompact(notice.salaryCents)}: abaixo do seu mínimo`);
    } else {
      salaryScore = 1;
      salaryReason = profile.minSalaryCents !== null ? "Salário acima do mínimo" : formatCurrencyCompact(notice.salaryCents);
    }
  }

  const preferredBoard =
    notice.examBoard !== null && profile.examBoards.some((board) => fold(board).trim() === fold(notice.examBoard!));
  const boardScore = profile.examBoards.length === 0 ? 0.5 : preferredBoard ? 1 : 0;

  if (registrationEnd) {
    const left = daysUntil(registrationEnd, today);
    if (left <= 7) warnings.push(left === 0 ? "Inscrições terminam hoje" : `Inscrições terminam em ${formatDayCount(left)}`);
  }

  const educationText = education === "superior" ? "Nível superior" : education === "tecnico" ? "Nível técnico" : education === "medio" ? "Nível médio" : education === "fundamental" ? "Nível fundamental" : null;
  const reasons = [
    role.role.title.length <= 70 ? role.role.title : `${role.role.title.slice(0, 67)}…`,
    educationText,
    place.reason,
    salaryReason,
    preferredBoard && `Banca preferida: ${notice.examBoard}`,
  ].filter((reason): reason is string => typeof reason === "string" && reason !== "");

  const earned =
    WEIGHTS.role * role.fraction +
    WEIGHTS.education * (education ? 1 : 0.7) +
    WEIGHTS.place * place.score +
    WEIGHTS.salary * salaryScore +
    WEIGHTS.board * boardScore;
  const score = Math.max(0, Math.min(100, Math.round(earned)));
  return { excluded: false, score, role: role.role.title, reasons, warnings };
}

/**
 * Bolsa ou salário, benefícios e horário, tirados da descrição da vaga.
 * Nenhuma fonte informa isso de forma estruturada (só o Lever, às vezes, o
 * salário), então são regras sobre o texto. Na dúvida, a informação fica de
 * fora: melhor não mostrar do que mostrar errado.
 */

import { fold, stripHtml } from "./text";

export type JobDetails = {
  /** Bolsa ou salário mensal, em centavos. */
  salaryCents: number | null;
  /** Benefícios citados na vaga, na ordem da lista abaixo. */
  benefits: string[];
  /** Jornada ("6h por dia", "30h por semana", "Das 9h às 15h"). */
  workload: string | null;
};

export const NO_DETAILS: JobDetails = { salaryCents: null, benefits: [], workload: null };

/**
 * A Gupy tira as tags das listas e junta os itens ("Vale-transporteSeguro de
 * vida"). Separa onde uma minúscula encosta numa maiúscula.
 */
export function separateGluedWords(text: string): string {
  return text.replace(/([a-zà-ÿ0-9)\].;:!?])([A-ZÀ-Þ])/g, "$1 $2");
}

/** Descrição do Greenhouse: HTML com as próprias tags escapadas (&lt;p&gt;). */
export function htmlToText(escapedHtml: string): string {
  const html = escapedHtml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return stripHtml(html);
}

// ---------------------------------------------------------------------------
// Bolsa e salário
// ---------------------------------------------------------------------------

/** Faixa aceita para um valor mensal: fora dela, provavelmente não é a remuneração. */
const MIN_MONTHLY = 300;
const MAX_MONTHLY = 50_000;

/**
 * Valor perto de uma palavra de remuneração: "Bolsa: R$1.000,00",
 * "bolsa-auxílio de R$ 1.800", "Salário: R$ 3.500 a R$ 4.000" (vale o menor).
 * "Bolsa de estudos" e "bolsa de valores" não contam.
 */
const PAY_PATTERN =
  /(?:bolsa(?![- ]de (?:estudo|valores))(?:[- ]auxilio)?|salario|remuneracao)[^.;!?]{0,40}?r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?(?!\d)([^\n]{0,14})/g;

export function extractSalaryCents(foldedText: string): number | null {
  for (const match of foldedText.matchAll(PAY_PATTERN)) {
    const after = match[3];
    // Por hora, por dia ou "R$ 10 milhões" não é bolsa mensal.
    if (/^\s*(?:\/|por |a |ao )\s*(?:hora|h\b|dia)|^\s*(?:mil|milh|bilh|mi\b|bi\b|k\b)/.test(after)) continue;
    const reais = Number(match[1].replace(/\./g, ""));
    if (reais < MIN_MONTHLY || reais > MAX_MONTHLY) continue;
    return reais * 100 + Number(match[2] ?? 0);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Benefícios
// ---------------------------------------------------------------------------

/**
 * Onde começa a parte de benefícios. Antes disso costuma vir a apresentação da
 * empresa, que fala de "plano de saúde" quando a empresa vende plano de saúde.
 * Sem essa parte, nenhum benefício é mostrado.
 */
const BENEFITS_START =
  /benef[ií]cios?(?![a-z])|\bbenefits\b|o que (?:n[oó]s )?oferecemos|\bwhat we offer\b|informa[cç][oõ]es adicionais|\bvantagens\b/i;

type BenefitRule = {
  label: string;
  /** No texto sem acentos e em minúsculas. */
  pattern: RegExp;
  /** Siglas, no texto original (só em maiúsculas: "VT", não "vt"). */
  acronym?: RegExp;
};

const BENEFITS: readonly BenefitRule[] = [
  {
    label: "Vale-transporte",
    pattern: /vale[- ]?transporte|auxilio[- ]?(?:transporte|mobilidade|combustivel)/,
    acronym: /\bVT\b/,
  },
  { label: "Transporte fretado", pattern: /fretado/ },
  {
    label: "Vale-refeição",
    pattern: /vale[- ]?(?:refeicao|lanche)|ticket refeicao|auxilio[- ]?(?:refeicao|lanche)/,
    acronym: /\bVR\b/,
  },
  {
    label: "Vale-alimentação",
    pattern: /vale[- ]?alimentacao|ticket alimentacao|auxilio[- ]?alimentacao/,
    acronym: /\bVA\b/,
  },
  { label: "Refeitório", pattern: /refeitorio|refeicao no local|alimentacao no local|restaurante (?:no local|interno|na empresa)/ },
  {
    label: "Cartão flexível",
    pattern: /beneficios? flexive(?:l|is)|cartao (?:de beneficios )?flex|\b(?:flash|caju|swile|alelo|pluxee)\b|i ?food beneficios/,
  },
  {
    label: "Plano de saúde",
    pattern: /planos? de saude|assistencia medica|convenio medico|plano medico|seguro saude|saude e odonto/,
  },
  { label: "Plano odontológico", pattern: /odontologic|convenio dental|plano dental|assistencia dental/ },
  { label: "Seguro de vida", pattern: /seguro de vida/ },
  {
    label: "Academia",
    pattern: /gympass|wellhub|total ?pass|(?:auxilio|convenio|desconto|parceria|subsidio)(?: com| em| de| para)? academias?/,
  },
  {
    label: "Auxílio home office",
    pattern: /auxilio[- ]?(?:home[- ]?office|remoto|internet|conectividade)|ajuda de custo (?:para |de |com )?(?:o )?(?:home[- ]?office|internet)/,
  },
  { label: "PLR", pattern: /\bplr\b|\bppr\b|participacao nos lucros|participacao (?:nos|em) resultados/ },
  { label: "Auxílio-creche", pattern: /auxilio[- ]?(?:creche|baba)|reembolso[- ]creche/ },
  {
    label: "Auxílio educação",
    pattern:
      /auxilio[- ]?(?:educacao|educacional|idiomas?|estudos?|graduacao)|bolsas? de estudos?|subsidio (?:educacional|de estudos|para (?:cursos|estudos))|reembolso (?:de )?(?:cursos|educacao|mensalidade)|descontos? em (?:cursos|faculdades?|universidades?|instituicoes de ensino)/,
  },
  { label: "Previdência privada", pattern: /previdencia privada/ },
  { label: "Apoio psicológico", pattern: /apoio psicologico|terapia online|sessoes de terapia|zenklub|programa de saude mental/ },
  { label: "Day off", pattern: /day ?off|folga no (?:dia do )?(?:seu )?aniversario/ },
  { label: "Horário flexível", pattern: /horarios? flexive(?:l|is)|flexibilidade de horario|jornada flexivel/ },
  { label: "Recesso remunerado", pattern: /recesso remunerado/ },
  { label: "Cesta básica", pattern: /cesta basica/ },
];

/** No máximo esta quantidade de benefícios por vaga. */
export const MAX_BENEFITS = 12;

export function extractBenefits(text: string): string[] {
  const start = BENEFITS_START.exec(text);
  if (!start) return [];
  const section = text.slice(start.index);
  const folded = fold(section);
  return BENEFITS.filter((rule) => rule.pattern.test(folded) || (rule.acronym?.test(section) ?? false))
    .map((rule) => rule.label)
    .slice(0, MAX_BENEFITS);
}

// ---------------------------------------------------------------------------
// Horário
// ---------------------------------------------------------------------------

const HOURS = String.raw`(?:h|hs|hrs?|horas)`;
const DAILY = new RegExp(String.raw`\b(\d{1,2})\s*${HOURS}\s*(?:diarias|diarios|por dia|\/dia|ao dia|diariamente)`);
const WEEKLY = new RegExp(String.raw`\b(\d{2})\s*${HOURS}\s*(?:semanais|por semana|\/semana|semanalmente|na semana)`);
const WORKLOAD = new RegExp(String.raw`carga horaria(?: semanal| diaria)?\s*(?:de|:|-)?\s*(\d{1,2})\s*${HOURS}\b`);
/** "das 9h às 15h", "Horário: 07:00 às 13:00hs". O fim precisa ter "h" ou ":00". */
const RANGE = new RegExp(
  String.raw`\b(?:das|de|horario:?|horario de trabalho:?|expediente:?)\s*(\d{1,2})(?:[:h](\d{2}))?(?:\s*${HOURS})?` +
    String.raw`\s*(?:as|a|ate|-)\s*(\d{1,2})(?:[:h](\d{2})(?:\s*${HOURS})?|\s*${HOURS})(?![a-z0-9])`,
  "g",
);

function clock(hour: number, minutes: number): string {
  return minutes > 0 ? `${hour}h${String(minutes).padStart(2, "0")}` : `${hour}h`;
}

export function extractWorkload(foldedText: string): string | null {
  const daily = DAILY.exec(foldedText);
  if (daily && Number(daily[1]) >= 3 && Number(daily[1]) <= 10) return `${Number(daily[1])}h por dia`;

  const weekly = WEEKLY.exec(foldedText);
  if (weekly && Number(weekly[1]) >= 12 && Number(weekly[1]) <= 44) return `${Number(weekly[1])}h por semana`;

  const workload = WORKLOAD.exec(foldedText);
  if (workload) {
    const hours = Number(workload[1]);
    if (hours >= 3 && hours <= 10) return `${hours}h por dia`;
    if (hours >= 12 && hours <= 44) return `${hours}h por semana`;
  }

  for (const match of foldedText.matchAll(RANGE)) {
    const [startHour, startMinutes, endHour, endMinutes] = [match[1], match[2], match[3], match[4]].map((part) =>
      Number(part ?? 0),
    );
    const length = endHour + endMinutes / 60 - (startHour + startMinutes / 60);
    if (startHour < 5 || endHour > 23 || startMinutes > 59 || endMinutes > 59 || length < 4 || length > 10) continue;
    return `Das ${clock(startHour, startMinutes)} às ${clock(endHour, endMinutes)}`;
  }
  return null;
}

/** Tudo de uma vez, a partir do texto da vaga (sem HTML). */
export function extractJobDetails(text: string): JobDetails {
  if (!text.trim()) return NO_DETAILS;
  const separated = separateGluedWords(text);
  const folded = fold(separated);
  return {
    salaryCents: extractSalaryCents(folded),
    benefits: extractBenefits(separated),
    workload: extractWorkload(folded),
  };
}

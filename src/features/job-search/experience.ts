/**
 * Experiência: os anos que a vaga pede, lidos da descrição, comparados com o que
 * o currículo soma. Muitas vagas pedem e aceitam menos, por isso a diferença de
 * até um ano só gera aviso. Na dúvida, a vaga fica.
 */

import { experienceLabel } from "@/features/resume/extract";
import type { JobType } from "@/lib/options";

const NUMBER = "\\d{1,2}|uma?|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez";
const WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};
const NOT_INSIDE_WORD = "(?<![a-z\\d/.])";

const DEMANDS = [
  // "04 anos de experiência", "3 a 5 anos de experiência", "5 anos ou mais de experiência"
  new RegExp(`${NOT_INSIDE_WORD}(${NUMBER})(?: (?:a|e) \\d{1,2})?(?: \\(\\p{L}+\\))?\\+? anos?(?: ou mais)? (?:de|em) (?:experiencia|atuacao|vivencia)`, "gu"),
  // "experiência mínima de 2 anos", "experiência: entre 3 e 4 anos", "vivência de 1 ano"
  new RegExp(`(?:experiencia|vivencia)[^.;]{0,45}?${NOT_INSIDE_WORD}(${NUMBER})(?: (?:a|e) \\d{1,2})?\\+? anos?(?![a-z])(?! de idade)`, "gu"),
  // "3+ years of experience", "2 years of relevant experience"
  /(?<![a-z\d/.])(\d{1,2})\+? years?(?: of)?(?: [a-z-]+){0,3} experience/g,
];

/** Empresa falando de si: "completamos 50 anos de experiência no setor". */
const ABOUT_COMPANY = /completamos|somos|empresa|companhia|tradicao|historia|marca|(?:com|ha) mais de|sao cerca de/;
const COMPANY_FIELD = /^ (?:no|de) (?:mercado|setor)/;
/** Ninguém pede tanto para uma vaga de entrada: é quase sempre a idade da empresa. */
const MAX_YEARS = 15;
const SOFT = /desejav|diferencia(?:l|is)|preferenc|\bplus\b|nice to have|sera considerado/;

/**
 * Poucas vagas dizem os anos (19 em 527 na amostra real). As outras dizem em
 * palavras: "experiência sólida em Python". "Experiência em X" não entra, porque
 * é comum demais em vaga de entrada.
 */
const STRONG =
  /(?:experiencia|vivencia|atuacao)s?(?: [a-z]+)? (?:solida|consolidada|ampla|robusta|profunda|aprofundada|extensa|vasta|significativa|avancada)|(?:solida|ampla|forte|vasta|robusta|extensa) (?:experiencia|vivencia)/g;

export type ExperienceDemand = {
  required: number | null;
  desired: number | null;
  /** Experiência forte, dita em palavras. */
  strong: "exigida" | "desejavel" | null;
};

function strongDemand(foldedText: string): ExperienceDemand["strong"] {
  let strong: ExperienceDemand["strong"] = null;
  for (const match of foldedText.matchAll(STRONG)) {
    const before = foldedText.slice(Math.max(0, match.index - 60), match.index);
    if (!SOFT.test(before.slice(before.lastIndexOf(".") + 1))) return "exigida";
    strong = "desejavel";
  }
  return strong;
}

/** Quantos anos a vaga pede. Vale o maior: "5 anos, sendo 2 com liderança" são 5. */
export function experienceDemand(foldedText: string): ExperienceDemand {
  const demand: ExperienceDemand = { required: null, desired: null, strong: strongDemand(foldedText) };
  for (const pattern of DEMANDS) {
    for (const match of foldedText.matchAll(pattern)) {
      const years = WORDS[match[1]] ?? Number(match[1]);
      if (!years || years > MAX_YEARS) continue;

      const end = match.index + match[0].length;
      const before = foldedText.slice(Math.max(0, match.index - 60), match.index);
      const sentence = before.slice(before.lastIndexOf(".") + 1);
      const after = foldedText.slice(end, end + 30);
      if (ABOUT_COMPANY.test(sentence) && (COMPANY_FIELD.test(after) || !/experiencia|vivencia/.test(sentence))) continue;

      const soft = SOFT.test(sentence) || SOFT.test(after.split(/[.;]/)[0]);
      const key = soft ? "desired" : "required";
      demand[key] = Math.max(demand[key] ?? 0, years);
    }
  }
  return demand;
}

function yearsLabel(years: number): string {
  return years === 1 ? "1 ano" : `${years} anos`;
}

export type ExperienceFit = { excluded: string | null; warnings: string[] };

const FITS: ExperienceFit = { excluded: null, warnings: [] };
/** Até esta diferença (em meses) a vaga fica, com aviso. */
const TOLERANCE_MONTHS = 12;
/** "Experiência sólida" não diz quanto: menos de dois anos dificilmente é sólida. */
const STRONG_MONTHS = 24;

/** `experience` é null sem currículo; `months` é null quando ele não permitiu somar. */
export function experienceFit(
  foldedJobText: string,
  jobType: JobType | null,
  experience: { months: number | null } | null,
): ExperienceFit {
  // Estágio é para quem está começando; o que a descrição pedir não muda isso.
  if (!experience || jobType === "estagio") return FITS;
  const { months } = experience;
  const { required, desired, strong } = experienceDemand(foldedJobText);

  if (required !== null) {
    if (months === null) return { ...FITS, warnings: [`Pede ${yearsLabel(required)} de experiência: não achamos no seu currículo`] };
    const missing = required * 12 - months;
    const summed = months === 0 ? "seu currículo não soma experiência" : `seu currículo soma ${experienceLabel(months)}`;
    if (missing > TOLERANCE_MONTHS) return { ...FITS, excluded: `Pede ${yearsLabel(required)} de experiência: ${summed}` };
    if (missing > 0) return { ...FITS, warnings: [`Pede ${yearsLabel(required)} de experiência: ${summed}`] };
    return FITS;
  }
  if (strong === "exigida") {
    if (months === null) return { ...FITS, warnings: ["Pede experiência sólida: não achamos no seu currículo"] };
    if (months < STRONG_MONTHS) return { ...FITS, excluded: "Pede experiência sólida na área" };
    return FITS;
  }
  if (desired !== null && months !== null && desired * 12 > months) {
    return { ...FITS, warnings: [`${yearsLabel(desired)} de experiência é desejável`] };
  }
  if (strong === "desejavel" && months !== null && months < STRONG_MONTHS) {
    return { ...FITS, warnings: ["Experiência sólida é desejável"] };
  }
  return FITS;
}

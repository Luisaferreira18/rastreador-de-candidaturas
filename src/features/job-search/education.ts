/**
 * Formação: o que a vaga pede, lido da descrição, comparado com o currículo.
 *
 * As descrições chegam sem quebras de linha e com títulos colados no texto
 * ("qualificacoesensino superior completo"), por isso as expressões não
 * dependem do começo da palavra. Na dúvida, a vaga fica: só sai o que está
 * escrito com clareza ("ensino superior completo", sem "ou cursando" ao lado).
 */

import { courseAreas, findCitedCourses } from "@/features/resume/extract";
import type { JobType } from "@/lib/options";
import type { ResumeEducation } from "./types";

// ---------------------------------------------------------------------------
// Curso completo
// ---------------------------------------------------------------------------

export type DegreeDemand = "exigido" | "provavel" | "desejavel" | null;

const COMPLETED_DEGREE =
  /(?<!pos[- ]?)(?:superior|graduacao|bacharelado)(?: tecnologo| tecnologico)? (?:complet[oa]|concluid[oa])|(?:^|[^a-z])(?:formad[oa]|graduad[oa])(?: ?[(/][ao]\)?)? (?:em|no curso de) (?!(?:19|20)\d\d)|recem[- ]formad[oa]|bachelor'?s? degree|completed (?:a )?degree/g;

/** "Completo ou em andamento", logo depois: quem está cursando também serve. */
const ALSO_STUDYING =
  /^[^.;]{0,40}?(?:cursando|andamento|incomplet|em curso(?! de)|concluindo|fase de conclusao|ultimos? (?:anos?|semestres?|periodos?)|graduando|pursuing|currently|or equivalent)/;
/** "Técnico ou superior completo": o curso superior é só uma das opções. */
const OTHER_OPTION = /(?:medio|tecnico|tecnologo)[^.;]{0,15}(?:ou|\/)\s*$/;
/** "Não ter superior completo" (programas para quem ainda estuda). */
const NEGATED = /(?:^|[^a-z])(?:nao|sem)(?:[^a-z][^.;]{0,25})?$/;
/** "Currently pursuing a bachelor's degree". */
const STILL_STUDYING = /cursando|pursuing|currently|enrolled/;
/** "Uma equipe formada em...": fala da empresa, não da pessoa. */
const ABOUT_COMPANY = /(?:empresa|equipe|time|grupo|companhia|rede|somos|marca)[^.;]{0,25}$/;
const SOFT = /desejav|diferencia(?:l|is)|preferenc|\bplus\b|\bbonus\b|nice to have|sera considerado|se tiver/;

/** "Formação superior em X", sem dizer se precisa ter terminado. */
const UNSPECIFIED_DEGREE = /(?<!pos[- ]?)(?:formacao superior|ensino superior|graduacao|bacharelado)[^.;]{0,15} em /;

/** Só a frase em que o termo aparece: "diferencial. Requisitos: superior completo" é exigência. */
function sameSentence(before: string): string {
  return before.slice(before.lastIndexOf(".") + 1);
}

/** A vaga pede curso superior terminado? */
export function degreeDemand(foldedText: string): DegreeDemand {
  let demand: DegreeDemand = null;
  for (const match of foldedText.matchAll(COMPLETED_DEGREE)) {
    const after = foldedText.slice(match.index + match[0].length, match.index + match[0].length + 60);
    const before = foldedText.slice(Math.max(0, match.index - 60), match.index + (match[0].length - match[0].trimStart().length));
    if (ALSO_STUDYING.test(after) || OTHER_OPTION.test(before) || NEGATED.test(before) || STILL_STUDYING.test(sameSentence(before))) continue;
    if (/formad|graduad/.test(match[0]) && ABOUT_COMPANY.test(before)) continue;
    if (!SOFT.test(sameSentence(before))) return "exigido";
    demand = "desejavel";
  }
  if (demand || /cursando|andamento|incomplet/.test(foldedText)) return demand;

  const unspecified = UNSPECIFIED_DEGREE.exec(foldedText);
  if (!unspecified) return null;
  const before = foldedText.slice(Math.max(0, unspecified.index - 60), unspecified.index);
  return SOFT.test(sameSentence(before)) || OTHER_OPTION.test(before) ? null : "provavel";
}

// ---------------------------------------------------------------------------
// Período de formatura
// ---------------------------------------------------------------------------

export type GraduationWindow = { from: number | null; to: number | null };

const WINDOW_START =
  /formatura|previsao de (?:formacao|conclusao|termino)|conclusao(?: do curso| da graduacao| prevista|:| entre| a partir| em \d| no \d)|formacao (?:prevista|entre|a partir|de \p{L}+ de 20)|formad[oa]s?(?:\(as?\))? (?:entre|a partir|ate|em 20)|termino (?:do curso|da graduacao|previsto)/gu;

/**
 * Quando a vaga quer que a pessoa se forme: "a partir de 12/2027",
 * "no 1º semestre de 2027 até o 1º semestre de 2029", "entre 2024 e 2026".
 */
export function graduationWindow(foldedText: string): GraduationWindow | null {
  for (const match of foldedText.matchAll(WINDOW_START)) {
    const start = match.index + match[0].length;
    // Até o fim da frase, sem cortar "2028.1".
    const sentence = foldedText.slice(start, start + 80).split(/;|\.(?!\d)/)[0];
    const years = [...sentence.matchAll(/(?<![\d/.])(?:\d{1,2}\/)?(20[2-4]\d)(?!\d)|\/(20[2-4]\d)(?!\d)/g)].map((found) =>
      Number(found[1] ?? found[2]),
    );
    if (years.length === 0) continue;

    // Com o começo junto: em "formados até 2026", o "até" está nele.
    const phrase = `${match[0]} ${sentence}`;
    const opensAfter = /a partir|apos|depois de|posterior|ou mais/.test(phrase);
    const closes = /(?:^|[^a-z])ate(?:[^a-z]|$)/.test(phrase);
    const first = Math.min(...years);
    const last = Math.max(...years);
    if (years.length > 1) return { from: first, to: last };
    if (opensAfter) return { from: first, to: null };
    if (closes) return { from: null, to: last };
    return { from: first, to: first };
  }
  return null;
}

function windowLabel({ from, to }: GraduationWindow): string {
  if (from !== null && to !== null) return from === to ? `em ${from}` : `entre ${from} e ${to}`;
  return from !== null ? `a partir de ${from}` : `até ${to}`;
}

// ---------------------------------------------------------------------------
// Curso pedido
// ---------------------------------------------------------------------------

const COURSE_LIST_START =
  /cursando|graduando|estudante de|nos cursos de|(?:superior|graduacao|bacharelado|formacao)[^.;]{0,35}? em(?:[^a-z]|$)/g;
/** "Ou áreas afins": a lista é só um exemplo. */
const OPEN_LIST =
  /afins|correlat|relacionad|similar|qualquer|todos os cursos|outros cursos|demais|areas? de|entre outros|\betc\b|exatas|humanas|tecnologia(?! da informacao)|preferencial/;

/** Cursos que a vaga lista, quando a lista é fechada. */
export function citedCourses(foldedText: string): string[] {
  const cited = new Set<string>();
  for (const match of foldedText.matchAll(COURSE_LIST_START)) {
    // "Desejável cursando Administração" não fecha a vaga para os outros cursos.
    if (SOFT.test(foldedText.slice(Math.max(0, match.index - 40), match.index))) continue;
    const start = match.index + match[0].length;
    const sentence = foldedText.slice(start, start + 200).split(/;|\.(?!\d)/)[0];
    // A lista começa logo depois: "graduação e quer uma carreira em... logística" não é lista.
    if (findCitedCourses(sentence.slice(0, 30)).length === 0) continue;
    if (OPEN_LIST.test(sentence)) return [];
    for (const course of findCitedCourses(sentence)) cited.add(course);
  }
  return [...cited];
}

const TECH_AREAS = new Set(["Desenvolvimento", "Dados", "Tecnologia"]);

/** Cursos parecidos não geram aviso (Sistemas de Informação e Ciência da Computação). */
function coursesMatch(own: string, cited: string): boolean {
  if (own === cited) return true;
  if ((own === "Engenharia" && cited.startsWith("Engenharia")) || (cited === "Engenharia" && own.startsWith("Engenharia"))) return true;
  const ownAreas = courseAreas(own);
  const citedAreas = courseAreas(cited);
  return ownAreas.some((area) => citedAreas.includes(area) || (TECH_AREAS.has(area) && citedAreas.some((other) => TECH_AREAS.has(other))));
}

// ---------------------------------------------------------------------------
// Tudo junto
// ---------------------------------------------------------------------------

export type EducationFit = {
  /** Motivo para a vaga sair da lista, ou null. */
  excluded: string | null;
  warnings: string[];
  /** A vaga lista cursos e o da pessoa não está entre eles. */
  otherCourse: boolean;
};

const FITS: EducationFit = { excluded: null, warnings: [], otherCourse: false };

/** Sem currículo, ou sem a situação do curso, nada muda. */
export function educationFit(
  foldedJobText: string,
  jobType: JobType | null,
  education: ResumeEducation | null,
  currentYear: number,
): EducationFit {
  if (!education) return FITS;
  const { course, status, graduationYear } = education;
  const warnings: string[] = [];

  if (graduationYear !== null) {
    const wanted = graduationWindow(foldedJobText);
    if (wanted && ((wanted.from !== null && graduationYear < wanted.from) || (wanted.to !== null && graduationYear > wanted.to))) {
      return { ...FITS, excluded: `Pede formatura ${windowLabel(wanted)}, e a sua é em ${graduationYear}` };
    }
  }

  // Estágio é sempre para quem estuda: o que a descrição diz de "completo" não vale aqui.
  if (status === "cursando" && jobType !== "estagio") {
    const demand = degreeDemand(foldedJobText);
    if (demand === "exigido") {
      // Quem se forma este ano pode terminar a tempo: a pessoa decide.
      if (graduationYear !== currentYear) return { ...FITS, excluded: "Pede ensino superior completo" };
      warnings.push(`Pede superior completo: sua formatura é em ${graduationYear}`);
    } else if (demand === "desejavel") {
      warnings.push("Superior completo é desejável: você ainda está cursando");
    } else if (demand === "provavel") {
      warnings.push("Pede formação superior: confira se aceita quem está cursando");
    }
  }
  if (status === "concluido" && jobType === "estagio") {
    warnings.push("Estágio pede matrícula ativa: seu currículo diz curso concluído");
  }

  let otherCourse = false;
  if (course) {
    const cited = citedCourses(foldedJobText);
    if (cited.length > 0 && !cited.some((name) => coursesMatch(course, name))) {
      otherCourse = true;
      warnings.push(`A vaga cita ${cited.slice(0, 3).join(", ")}: seu curso é ${course}`);
    }
  }
  return { excluded: null, warnings, otherCourse };
}

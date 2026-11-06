/**
 * Lê o texto do currículo (já tirado do PDF) e encontra o que interessa à
 * busca de vagas: habilidades, idiomas, curso, cidade e cargos sugeridos.
 * São regras simples, como o resto da busca, e o resultado é uma sugestão:
 * a pessoa confere antes de usar no perfil.
 *
 * Nome, telefone, e-mail, endereço e documentos não são lidos nem guardados.
 */

import { findCities, isUF, ufOfCity, type UF } from "@/features/job-search/brazil";
import { fold } from "@/features/job-search/text";
import type { JobType } from "@/lib/options";
import { SKILLS, mentionsSkill, skillArea } from "./skills";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export const LANGUAGE_LEVELS = ["basico", "intermediario", "avancado", "fluente", "nativo"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  basico: "básico",
  intermediario: "intermediário",
  avancado: "avançado",
  fluente: "fluente",
  nativo: "nativo",
};

export type ResumeLanguage = { name: string; level: LanguageLevel | null };
export type EducationStatus = "cursando" | "concluido";

export type ResumeExtraction = {
  skills: string[];
  languages: ResumeLanguage[];
  course: string | null;
  educationStatus: EducationStatus | null;
  graduationYear: number | null;
  /** Meses de experiência somados, ou null se o currículo não permitiu somar. */
  experienceMonths: number | null;
  city: string | null;
  state: UF | null;
  /** Cargos para o perfil de busca ("Estágio em Dados"). */
  roles: string[];
  /** Tipos de vaga que combinam com a fase do curso. */
  jobTypes: JobType[];
};

/** No máximo esta quantidade de cargos sugeridos. */
export const MAX_SUGGESTED_ROLES = 3;

// ---------------------------------------------------------------------------
// Habilidades
// ---------------------------------------------------------------------------

export function findSkills(foldedText: string): string[] {
  return SKILLS.filter((skill) => mentionsSkill(foldedText, skill.label)).map((skill) => skill.label);
}

// ---------------------------------------------------------------------------
// Idiomas
// ---------------------------------------------------------------------------

const LANGUAGES: readonly { name: string; terms: readonly string[] }[] = [
  { name: "Inglês", terms: ["ingles", "english"] },
  { name: "Espanhol", terms: ["espanhol", "spanish", "espanol"] },
  { name: "Francês", terms: ["frances", "french"] },
  { name: "Alemão", terms: ["alemao", "german"] },
  { name: "Italiano", terms: ["italiano", "italian"] },
  { name: "Japonês", terms: ["japones", "japanese"] },
  { name: "Mandarim", terms: ["mandarim", "chines", "chinese"] },
  { name: "Libras", terms: ["libras"] },
];

const LEVEL_PATTERNS: readonly [LanguageLevel, RegExp][] = [
  ["nativo", /\b(?:nativo|nativa|native|lingua materna)\b/],
  ["fluente", /\b(?:fluente|fluent|fluencia|c2)\b/],
  ["avancado", /\b(?:avancado|avancada|advanced|c1)\b/],
  ["intermediario", /\b(?:intermediario|intermediaria|intermediate|b1|b2)\b/],
  ["basico", /\b(?:basico|basica|basic|iniciante|elementar|a1|a2)\b/],
];

const ANY_LANGUAGE = new RegExp(`\\b(?:${LANGUAGES.flatMap((language) => language.terms).join("|")})\\b`);

/** Nível citado logo depois do idioma ("Inglês: avançado", "Inglês (B2)"). */
function levelAfter(foldedText: string, from: number): LanguageLevel | null {
  let window = foldedText.slice(from, from + 40);
  // Para no próximo idioma: "Inglês: avançado | Espanhol: básico".
  const next = ANY_LANGUAGE.exec(window);
  if (next) window = window.slice(0, next.index);

  let best: { level: LanguageLevel; index: number } | null = null;
  for (const [level, pattern] of LEVEL_PATTERNS) {
    const match = pattern.exec(window);
    if (match && (!best || match.index < best.index)) best = { level, index: match.index };
  }
  return best?.level ?? null;
}

export function findLanguages(foldedText: string): ResumeLanguage[] {
  const found: ResumeLanguage[] = [];
  for (const language of LANGUAGES) {
    const pattern = new RegExp(`\\b(?:${language.terms.join("|")})\\b`, "g");
    let level: LanguageLevel | null = null;
    let mentioned = false;
    for (const match of foldedText.matchAll(pattern)) {
      mentioned = true;
      // Vale o nível mais alto citado para o idioma.
      const candidate = levelAfter(foldedText, match.index + match[0].length);
      if (candidate && (!level || LANGUAGE_LEVELS.indexOf(candidate) > LANGUAGE_LEVELS.indexOf(level))) level = candidate;
    }
    if (mentioned) found.push({ name: language.name, level });
  }
  return found;
}

/** Posição do nível na escala (0 = básico), ou -1 sem nível. */
export function levelRank(level: LanguageLevel | null): number {
  return level ? LANGUAGE_LEVELS.indexOf(level) : -1;
}

// ---------------------------------------------------------------------------
// Curso
// ---------------------------------------------------------------------------

type Course = { name: string; terms: readonly string[]; areas: readonly string[] };

/** Os mais específicos primeiro ("Engenharia de Produção" antes de "Engenharia"). */
const COURSES: readonly Course[] = [
  { name: "Ciência da Computação", terms: ["ciencia da computacao", "ciencias da computacao", "computer science"], areas: ["Desenvolvimento"] },
  { name: "Engenharia de Software", terms: ["engenharia de software", "software engineering"], areas: ["Desenvolvimento"] },
  { name: "Engenharia de Computação", terms: ["engenharia de computacao", "engenharia da computacao"], areas: ["Desenvolvimento"] },
  { name: "Sistemas de Informação", terms: ["sistemas de informacao"], areas: ["Desenvolvimento", "Tecnologia"] },
  { name: "Análise e Desenvolvimento de Sistemas", terms: ["analise e desenvolvimento de sistemas"], areas: ["Desenvolvimento"] },
  { name: "Ciência de Dados", terms: ["ciencia de dados", "ciencias de dados", "data science"], areas: ["Dados"] },
  { name: "Tecnologia da Informação", terms: ["tecnologia da informacao", "redes de computadores"], areas: ["Tecnologia"] },
  { name: "Estatística", terms: ["estatistica"], areas: ["Dados"] },
  { name: "Matemática", terms: ["matematica aplicada", "matematica"], areas: ["Dados"] },
  { name: "Engenharia de Produção", terms: ["engenharia de producao"], areas: ["Engenharia de Produção"] },
  { name: "Engenharia Civil", terms: ["engenharia civil"], areas: ["Engenharia Civil"] },
  { name: "Engenharia Mecânica", terms: ["engenharia mecanica"], areas: ["Engenharia Mecânica"] },
  { name: "Engenharia Elétrica", terms: ["engenharia eletrica"], areas: ["Engenharia Elétrica"] },
  { name: "Engenharia Química", terms: ["engenharia quimica"], areas: ["Engenharia Química"] },
  { name: "Engenharia Ambiental", terms: ["engenharia ambiental"], areas: ["Engenharia Ambiental"] },
  { name: "Engenharia", terms: ["engenharia"], areas: ["Engenharia"] },
  { name: "Administração", terms: ["administracao de empresas", "administracao"], areas: ["Administração"] },
  { name: "Ciências Contábeis", terms: ["ciencias contabeis", "contabilidade"], areas: ["Contabilidade"] },
  { name: "Ciências Econômicas", terms: ["ciencias economicas", "economia"], areas: ["Finanças"] },
  { name: "Gestão Financeira", terms: ["gestao financeira"], areas: ["Finanças"] },
  { name: "Direito", terms: ["direito"], areas: ["Direito"] },
  { name: "Psicologia", terms: ["psicologia"], areas: ["Psicologia", "Recursos Humanos"] },
  { name: "Recursos Humanos", terms: ["gestao de recursos humanos", "recursos humanos", "gestao de pessoas"], areas: ["Recursos Humanos"] },
  { name: "Arquitetura e Urbanismo", terms: ["arquitetura e urbanismo", "arquitetura"], areas: ["Arquitetura"] },
  { name: "Design", terms: ["design grafico", "design digital", "design de produto", "design"], areas: ["Design"] },
  { name: "Publicidade e Propaganda", terms: ["publicidade e propaganda", "publicidade"], areas: ["Marketing"] },
  { name: "Marketing", terms: ["marketing"], areas: ["Marketing"] },
  { name: "Jornalismo", terms: ["jornalismo"], areas: ["Comunicação"] },
  { name: "Comunicação Social", terms: ["comunicacao social", "relacoes publicas"], areas: ["Comunicação"] },
  { name: "Relações Internacionais", terms: ["relacoes internacionais"], areas: ["Comércio Exterior"] },
  { name: "Comércio Exterior", terms: ["comercio exterior"], areas: ["Comércio Exterior"] },
  { name: "Logística", terms: ["logistica"], areas: ["Logística"] },
  { name: "Gestão Comercial", terms: ["gestao comercial"], areas: ["Comercial"] },
  { name: "Letras", terms: ["letras"], areas: ["Letras"] },
  { name: "Pedagogia", terms: ["pedagogia"], areas: ["Pedagogia"] },
  { name: "Nutrição", terms: ["nutricao"], areas: ["Nutrição"] },
  { name: "Enfermagem", terms: ["enfermagem"], areas: ["Enfermagem"] },
  { name: "Farmácia", terms: ["farmacia"], areas: ["Farmácia"] },
  { name: "Biomedicina", terms: ["biomedicina"], areas: ["Biomedicina"] },
  { name: "Fisioterapia", terms: ["fisioterapia"], areas: ["Fisioterapia"] },
  { name: "Ciências Biológicas", terms: ["ciencias biologicas", "biologia"], areas: ["Biologia"] },
  { name: "Medicina Veterinária", terms: ["medicina veterinaria", "veterinaria"], areas: ["Veterinária"] },
];

/** Área de um curso da lista. */
export function courseAreas(name: string): readonly string[] {
  return COURSES.find((course) => course.name === name)?.areas ?? [];
}

/** Nomes dos cursos da lista, para a pessoa corrigir o que foi lido. */
export const COURSE_NAMES: readonly string[] = COURSES.map((course) => course.name);

/** Títulos da parte de formação, do mais para o menos específico. */
const EDUCATION_HEADINGS = [/formacao academica/g, /escolaridade/g, /educacao/g, /education/g, /formacao/g];
const EDUCATION_WINDOW = 400;

/** Fora da parte de formação, o curso só conta com "graduação em", "bacharelado em"... */
const DEGREE_PREFIX =
  "(?:graduacao|graduando|graduanda|bacharelado|bacharel|licenciatura|tecnologo|curso superior|ensino superior|superior)\\s+(?:em|de)\\s+";

type CourseMatch = { course: Course; index: number; length: number };

/** O curso que vale é a graduação: "MBA em Marketing" não diz a situação dela. */
const NOT_THE_DEGREE = "(?<!(?:mba|pos[- ]?graduacao|especializacao|mestrado|doutorado|extensao|tecnico em|curso tecnico)[^.;|]{0,30})";

function courseRegExp(term: string, prefix = ""): RegExp {
  return new RegExp(`(^|[^a-z0-9])${NOT_THE_DEGREE}${prefix}${term.replace(/\s+/g, "\\s+")}($|[^a-z0-9])`);
}

/** Cursos citados num trecho de texto, sem repetir o genérico quando há o específico. */
export function findCitedCourses(foldedText: string): string[] {
  const found = COURSES.filter((course) => course.terms.some((term) => courseRegExp(term).test(foldedText))).map((course) => course.name);
  return found.filter((name) => name !== "Engenharia" || !/engenharia (?:de|da|civil|mecanica|eletrica|quimica|ambiental)/.test(foldedText));
}

function earliestCourse(text: string, prefix = ""): CourseMatch | null {
  let best: CourseMatch | null = null;
  for (const course of COURSES) {
    for (const term of course.terms) {
      const match = courseRegExp(term, prefix).exec(text);
      if (!match) continue;
      const index = match.index + match[1].length;
      const length = match[0].length - match[1].length - match[2].length;
      // No mesmo lugar, vale o nome mais longo ("engenharia de producao" > "engenharia").
      if (!best || index < best.index || (index === best.index && length > best.length)) best = { course, index, length };
    }
  }
  return best;
}

/** Onde a formação acaba: "Experiência 2022 - atual" não diz nada sobre o curso. */
const NEXT_SECTION =
  /experiencia|experience|habilidades|competencias|conhecimentos|idiomas|skills|languages|certifica|projetos|objetivo|voluntari|atividades|cursos complementares/;
/** Outra linha da formação, com datas próprias. */
const OTHER_ENTRY = /ensino medio|ensino fundamental|mba|pos[- ]?graduacao|especializacao|mestrado|doutorado|extensao|tecnico em|curso tecnico/;
const HAS_DATE_OR_STATUS = /\b(?:19|20)\d\d\b|cursando|em andamento|em curso|previs|conclu|formad[oa]|\d+\s*[oº°ª]?\s*(?:semestre|periodo)/;

function untilNextSection(text: string): string {
  const next = NEXT_SECTION.exec(text);
  return next ? text.slice(0, next.index) : text;
}

/** O trecho que fala só deste curso; se ele não tiver datas, toda a formação (datas antes do curso). */
function courseContext(section: string, found: CourseMatch): string {
  const rest = section.slice(found.index + found.length);
  const nextEntry = OTHER_ENTRY.exec(rest)?.index ?? rest.length;
  const nextCourse = earliestCourse(rest)?.index ?? rest.length;
  const own = section.slice(found.index, found.index + found.length + Math.min(nextEntry, nextCourse));
  return HAS_DATE_OR_STATUS.test(own) ? own : section;
}

/** O curso e o trecho do currículo que fala dele (para ler as datas). */
function findCourse(foldedText: string): { course: Course; context: string } | null {
  for (const heading of EDUCATION_HEADINGS) {
    for (const match of foldedText.matchAll(heading)) {
      const window = foldedText.slice(match.index, match.index + EDUCATION_WINDOW);
      // Em PDF de duas colunas, a parte seguinte pode vir antes do curso.
      const headingEnd = match[0].length;
      const section = window.slice(0, headingEnd) + untilNextSection(window.slice(headingEnd));
      const inSection = earliestCourse(section);
      if (inSection) return { course: inSection.course, context: courseContext(section, inSection) };
      const found = earliestCourse(window);
      if (found) return { course: found.course, context: window };
    }
  }
  const found = earliestCourse(foldedText, DEGREE_PREFIX);
  if (!found) return null;
  return {
    course: found.course,
    context: foldedText.slice(Math.max(0, found.index - 50), found.index) + untilNextSection(foldedText.slice(found.index, found.index + 250)),
  };
}

/** Cursando ou concluído, e o ano de formatura (previsto ou não). */
export function educationStatus(
  context: string,
  currentYear: number,
): { status: EducationStatus | null; graduationYear: number | null } {
  const years = [...context.matchAll(/\b(19[5-9]\d|20\d\d)\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year <= currentYear + 7);
  const latest = years.length > 0 ? Math.max(...years) : null;

  const thisYear = latest === currentYear ? latest : null;

  // Formatura prevista para depois deste ano.
  if (latest !== null && latest > currentYear) return { status: "cursando", graduationYear: latest };
  if (/cursando|em andamento|em curso|previs|\batual\b|\bpresente\b|\bate o momento\b/.test(context)) {
    return { status: "cursando", graduationYear: thisYear };
  }
  if (/conclu|formad[oa]|graduad[oa]|\bcomplet[oa]\b/.test(context)) return { status: "concluido", graduationYear: latest };
  // "5º semestre"
  if (/\d+\s*[oº°ª]?\s*(?:semestre|periodo)/.test(context)) return { status: "cursando", graduationYear: thisYear };
  if (latest !== null && latest < currentYear) return { status: "concluido", graduationYear: latest };
  return { status: null, graduationYear: null };
}

// ---------------------------------------------------------------------------
// Experiência (só o total: empresas e cargos não são guardados)
// ---------------------------------------------------------------------------

const EXPERIENCE_HEADING =
  /^(?:experiencias?(?: profissiona(?:l|is))?|historico profissional|trajetoria profissional|atuacao profissional|(?:work |professional )?experience|employment)\s*:?$/;
const OTHER_HEADING =
  /^(?:formacao|escolaridade|educacao|education|habilidades|competencias|conhecimentos|idiomas|linguas|skills|languages|certifica|cursos|projetos|referencias|premios|publicacoes|atividades|voluntari|resumo|objetivo|sobre|perfil)/;
const MAX_HEADING_LENGTH = 45;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ENGLISH_MONTHS: Record<string, string> = { feb: "fev", apr: "abr", may: "mai", aug: "ago", sep: "set", oct: "out", dec: "dez" };
const DATE = "(?:(?:(?<![a-z])(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-z]*\\.?(?:\\s+de\\s+|\\s*/\\s*|\\s+)|(?:\\d{1,2}[/.-])?(\\d{1,2})[/.-])?((?:19|20)\\d\\d))";
const DATE_RANGE = new RegExp(
  `${DATE}\\s*(?:[-–—]|(?<![a-z])(?:a|ate|to)(?![a-z]))\\s*(?:${DATE}|(atualmente|atual|presente|hoje|o momento|momento|current|present|now|em andamento))`,
  "g",
);

function monthIndex(name: string | undefined, number: string | undefined, fallback: number): number {
  if (name) return MONTHS.indexOf(ENGLISH_MONTHS[name] ?? name);
  const month = Number(number);
  return month >= 1 && month <= 12 ? month - 1 : fallback;
}

/** As linhas da seção de experiência, ou null se não houver um título claro. */
function experienceSection(text: string): string | null {
  const lines = fold(text.normalize("NFC")).split(/\r?\n/).map((line) => line.trim());
  const start = lines.findIndex((line) => line.length <= MAX_HEADING_LENGTH && EXPERIENCE_HEADING.test(line));
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.length <= MAX_HEADING_LENGTH && OTHER_HEADING.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end).join(" ");
}

/**
 * Soma os períodos da seção de experiência, sem contar duas vezes os que se
 * sobrepõem. Só com o ano, conta o ano inteiro: melhor sobrar do que faltar,
 * porque a soma pode tirar vagas da lista.
 */
export function findExperienceMonths(text: string, currentYear: number): number | null {
  const section = experienceSection(text);
  if (section === null) return null;

  const lastMonth = currentYear * 12 + 11;
  const periods: [number, number][] = [];
  for (const match of section.matchAll(DATE_RANGE)) {
    const [, startName, startNumber, startYear, endName, endNumber, endYear] = match;
    const start = Number(startYear) * 12 + monthIndex(startName, startNumber, 0);
    const end = endYear ? Number(endYear) * 12 + monthIndex(endName, endNumber, 11) : lastMonth;
    if (end >= start && start <= lastMonth) periods.push([start, Math.min(end, lastMonth)]);
  }
  if (periods.length === 0) return null;

  periods.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let covered = -1;
  for (const [start, end] of periods) {
    const from = Math.max(start, covered + 1);
    if (end >= from) total += end - from + 1;
    covered = Math.max(covered, end);
  }
  return Math.min(total, 1200);
}

/** "8 meses", "2 anos", "1 ano e 3 meses". */
export function experienceLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const monthsText = rest === 1 ? "1 mês" : `${rest} meses`;
  if (years === 0) return monthsText;
  const yearsText = years === 1 ? "1 ano" : `${years} anos`;
  return rest === 0 ? yearsText : `${yearsText} e ${monthsText}`;
}

// ---------------------------------------------------------------------------
// Cidade (só no começo do currículo, onde ficam os dados de contato)
// ---------------------------------------------------------------------------

const HEADER_LENGTH = 600;
const NOT_A_CITY = new Set(["centro", "brasil", "bairro", "rua", "avenida", "cep"]);

export function findCity(text: string): { city: string | null; state: UF | null } {
  const header = text.normalize("NFC").slice(0, HEADER_LENGTH);

  // "Belo Horizonte - MG", "Montes Claros/MG", "São Paulo, SP". As palavras
  // ficam na mesma linha, para não juntar o nome da pessoa, da linha de cima.
  const cityUF = /(\p{Lu}[\p{L}'’]+(?:[ \t]+(?:d[aeo]s?[ \t]+)?\p{Lu}[\p{L}'’]+){0,3})[ \t]*[-–,/][ \t]*([A-Z]{2})(?![\p{L}\d])/gu;
  for (const match of header.matchAll(cityUF)) {
    const [, city, uf] = match;
    if (isUF(uf) && !NOT_A_CITY.has(fold(city))) return { city: city.trim(), state: uf };
  }

  // Cidades conhecidas, sem estado ao lado ("Curitiba").
  const [known] = findCities(header);
  if (!known) return { city: null, state: null };
  // O nome como está escrito no currículo, com acentos ("sao paulo" → "São Paulo").
  const written = withAccents(known).exec(header);
  return { city: written ? written[0] : known, state: ufOfCity(known) };
}

const ACCENTED: Record<string, string> = { a: "aáàâãä", e: "eéèêë", i: "iíìîï", o: "oóòôõö", u: "uúùûü", c: "cç" };

/** Expressão que acha o texto com ou sem acentos, em maiúsculas ou minúsculas. */
function withAccents(folded: string): RegExp {
  const pattern = [...folded].map((char) => (char === " " ? "\\s+" : ACCENTED[char] ? `[${ACCENTED[char]}]` : char)).join("");
  return new RegExp(`(?<![\\p{L}\\d])${pattern}(?![\\p{L}\\d])`, "iu");
}

// ---------------------------------------------------------------------------
// Sugestões para o perfil
// ---------------------------------------------------------------------------

/** Áreas em que "Analista de ..." é o cargo de entrada mais comum. */
const ANALYST_AREAS = new Set([
  "Dados", "Marketing", "Finanças", "Recursos Humanos", "Comunicação", "Logística", "Comércio Exterior",
  "Tecnologia", "Contabilidade", "Administração", "Comercial",
]);

function roleFor(area: string, status: EducationStatus | null): string {
  if (status !== "concluido") return `Estágio em ${area}`;
  // Sem nível no nome, a busca já foca em vagas de entrada.
  return ANALYST_AREAS.has(area) ? `Analista de ${area}` : area;
}

export function suggestedJobTypes(status: EducationStatus | null, graduationYear: number | null, currentYear: number): JobType[] {
  if (status === "cursando") {
    return graduationYear !== null && graduationYear <= currentYear + 1 ? ["estagio", "trainee"] : ["estagio"];
  }
  if (status === "concluido") {
    return graduationYear !== null && graduationYear >= currentYear - 2 ? ["trainee", "clt"] : ["clt"];
  }
  return [];
}

/** Áreas com pelo menos duas habilidades no currículo, da mais citada para a menos. */
function skillAreas(skills: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    const area = skillArea(skill);
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);
}

/** Cargos para o perfil: primeiro os do curso, depois os das habilidades. */
export function suggestedRoles(course: string | null, skills: readonly string[], status: EducationStatus | null): string[] {
  const areas = [...(course ? courseAreas(course) : []), ...skillAreas(skills)];
  return [...new Set(areas.map((area) => roleFor(area, status)))].slice(0, MAX_SUGGESTED_ROLES);
}

// ---------------------------------------------------------------------------
// Tudo junto
// ---------------------------------------------------------------------------

export function extractResume(text: string, currentYear: number): ResumeExtraction {
  const folded = fold(text.normalize("NFC")).replace(/\s+/g, " ");
  const skills = findSkills(folded);
  const languages = findLanguages(folded);
  const course = findCourse(folded);
  const education = course ? educationStatus(course.context, currentYear) : { status: null, graduationYear: null };
  const { city, state } = findCity(text);

  return {
    skills,
    languages,
    course: course?.course.name ?? null,
    educationStatus: education.status,
    graduationYear: education.graduationYear,
    experienceMonths: findExperienceMonths(text, currentYear),
    city,
    state,
    roles: suggestedRoles(course?.course.name ?? null, skills, education.status),
    jobTypes: suggestedJobTypes(education.status, education.graduationYear, currentYear),
  };
}

/** Texto com cara de currículo? (PDF escaneado vem sem texto nenhum.) */
export function hasReadableText(text: string): boolean {
  return (text.match(/\p{L}/gu)?.length ?? 0) >= 80;
}

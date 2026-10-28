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

/** Títulos da parte de formação, do mais para o menos específico. */
const EDUCATION_HEADINGS = [/formacao academica/g, /escolaridade/g, /educacao/g, /education/g, /formacao/g];
const EDUCATION_WINDOW = 400;

/** Fora da parte de formação, o curso só conta com "graduação em", "bacharelado em"... */
const DEGREE_PREFIX =
  "(?:graduacao|graduando|graduanda|bacharelado|bacharel|licenciatura|tecnologo|curso superior|ensino superior|superior)\\s+(?:em|de)\\s+";

type CourseMatch = { course: Course; index: number; length: number };

function earliestCourse(text: string, prefix = ""): CourseMatch | null {
  let best: CourseMatch | null = null;
  for (const course of COURSES) {
    for (const term of course.terms) {
      const match = new RegExp(`(^|[^a-z0-9])${prefix}${term.replace(/\s+/g, "\\s+")}($|[^a-z0-9])`).exec(text);
      if (!match) continue;
      const index = match.index + match[1].length;
      const length = match[0].length - match[1].length - match[2].length;
      // No mesmo lugar, vale o nome mais longo ("engenharia de producao" > "engenharia").
      if (!best || index < best.index || (index === best.index && length > best.length)) best = { course, index, length };
    }
  }
  return best;
}

/** O curso e o trecho do currículo que fala dele (para ler as datas). */
function findCourse(foldedText: string): { course: Course; context: string } | null {
  for (const heading of EDUCATION_HEADINGS) {
    for (const match of foldedText.matchAll(heading)) {
      const window = foldedText.slice(match.index, match.index + EDUCATION_WINDOW);
      const found = earliestCourse(window);
      if (found) return { course: found.course, context: window };
    }
  }
  const found = earliestCourse(foldedText, DEGREE_PREFIX);
  if (!found) return null;
  return { course: found.course, context: foldedText.slice(Math.max(0, found.index - 50), found.index + 250) };
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

function suggestedJobTypes(status: EducationStatus | null, graduationYear: number | null, currentYear: number): JobType[] {
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

  const areas = [...(course?.course.areas ?? []), ...skillAreas(skills)];
  const roles = [...new Set(areas.map((area) => roleFor(area, education.status)))].slice(0, MAX_SUGGESTED_ROLES);

  return {
    skills,
    languages,
    course: course?.course.name ?? null,
    educationStatus: education.status,
    graduationYear: education.graduationYear,
    city,
    state,
    roles,
    jobTypes: suggestedJobTypes(education.status, education.graduationYear, currentYear),
  };
}

/** Texto com cara de currículo? (PDF escaneado vem sem texto nenhum.) */
export function hasReadableText(text: string): boolean {
  return (text.match(/\p{L}/gu)?.length ?? 0) >= 80;
}

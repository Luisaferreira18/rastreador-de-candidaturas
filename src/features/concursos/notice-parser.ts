/**
 * Leitor de edital de concurso, por regras (sem IA, sem custo), no mesmo
 * estilo do leitor da caixa de entrada.
 *
 * Recebe o texto do edital (colado ou baixado do link) e sugere órgão, cargos,
 * banca, salário, vagas, escolaridade, esfera, local, links e as datas do
 * cronograma. É só uma sugestão: a pessoa confere tudo antes de salvar.
 *
 * O que o leitor sabe:
 * - Cronogramas em tabela com a etapa antes da data ("Prova Objetiva | 08/11/2026")
 *   ou a data antes da etapa ("07/10/2026 | Publicação do Edital"), e datas no
 *   meio do texto ("inscrições de 05/10/2026 a 05/11/2026").
 * - Datas de leis e de outros editais ("Lei nº 8.112, de 11 de dezembro de 1990")
 *   e passos que não interessam (impugnação, restituição, heteroidentificação)
 *   ficam de fora.
 */

import { findUFs, isUF, toUF, type UF } from "@/features/job-search/brazil";
import type { DateKind, EducationLevel, Sphere } from "@/lib/concurso-options";
import { parseBRLToCents } from "@/lib/format";
import { sortSchedule } from "./schedule";

export type NoticeDate = { kind: DateKind; date: string; time: string | null; note: string | null };

export type NoticeReading = {
  organ: string | null;
  /** Cargos encontrados, na ordem do edital. */
  roles: string[];
  examBoard: string | null;
  /** Remunerações encontradas (em centavos), da maior para a menor. */
  salaries: number[];
  /** Valor da taxa de inscrição, quando aparece. */
  feeCents: number | null;
  vacancies: number | null;
  reserveList: boolean;
  education: EducationLevel | null;
  sphere: Sphere | null;
  city: string | null;
  state: UF | null;
  registrationUrl: string | null;
  noticeUrl: string | null;
  dates: NoticeDate[];
};

/** Minúsculas e sem acentos. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8,
  setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MONTH_NAMES = "janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

type RawDate = { day: number; month: number; year: number | null };
type DateToken = { index: number; end: number; dates: RawDate[]; range: boolean; time: string | null };

const pad = (value: number) => String(value).padStart(2, "0");

function toISO({ day, month, year }: RawDate): string | null {
  if (year === null || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  const check = new Date(`${iso}T12:00:00Z`);
  return check.getUTCDate() === day ? iso : null;
}

const fullYear = (year: string) => (year.length === 2 ? 2000 + Number(year) : Number(year));
const monthOf = (name: string) => MONTHS[fold(name)] ?? 0;

/**
 * Expressões de data, das mais longas para as mais curtas (a primeira que
 * casar num trecho vale). Cada uma devolve as datas que representa.
 */
const DATE_PATTERNS: { pattern: RegExp; read: (match: RegExpExecArray) => { dates: RawDate[]; range: boolean } }[] = [
  {
    // "12/10 a 25/10/2026", "13/10/2026 até 13/11/2026", "12 a 15/10/2026"
    pattern: /(?<![\d/.])(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\s*(?:a|à|até|ate|-|–)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?![\d/])/gi,
    read: (m) => {
      const endYear = fullYear(m[6]);
      const endMonth = Number(m[5]);
      return {
        range: true,
        dates: [
          { day: Number(m[1]), month: m[2] ? Number(m[2]) : endMonth, year: m[3] ? fullYear(m[3]) : endYear },
          { day: Number(m[4]), month: endMonth, year: endYear },
        ],
      };
    },
  },
  {
    // "8 e 09/10/2026", "17/02/2027 e 18/02/2027"
    pattern: /(?<![\d/.])(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\s+e\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?![\d/])/gi,
    read: (m) => {
      const year = fullYear(m[6]);
      const month = Number(m[5]);
      return {
        range: false,
        dates: [
          { day: Number(m[1]), month: m[2] ? Number(m[2]) : month, year: m[3] ? fullYear(m[3]) : year },
          { day: Number(m[4]), month, year },
        ],
      };
    },
  },
  {
    // "05/10/2026", "13/9/2026"
    pattern: /(?<![\d/.])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\d/])/g,
    read: (m) => ({ range: false, dates: [{ day: Number(m[1]), month: Number(m[2]), year: fullYear(m[3]) }] }),
  },
  {
    // "de 3 de novembro a 4 de dezembro de 2026", "6 a 15 de outubro de 2026"
    pattern: new RegExp(
      String.raw`(?<!\d)(\d{1,2})º?(?:\s+de\s+(${MONTH_NAMES}))?\s+(?:a|até|ate)\s+(\d{1,2})º?\s+de\s+(${MONTH_NAMES})(?:\s+de\s+(\d{4}))?`,
      "gi",
    ),
    read: (m) => {
      const year = m[5] ? Number(m[5]) : null;
      const endMonth = monthOf(m[4]);
      return {
        range: true,
        dates: [
          { day: Number(m[1]), month: m[2] ? monthOf(m[2]) : endMonth, year },
          { day: Number(m[3]), month: endMonth, year },
        ],
      };
    },
  },
  {
    // "8 de novembro de 2026", "1º de outubro de 2026"
    pattern: new RegExp(String.raw`(?<!\d)(\d{1,2})º?\s+de\s+(${MONTH_NAMES})(?:\s+de\s+(\d{4}))?`, "gi"),
    read: (m) => ({ range: false, dates: [{ day: Number(m[1]), month: monthOf(m[2]), year: m[3] ? Number(m[3]) : null }] }),
  },
];

const TIME = /(?<![\d/])(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/;

/** Hora perto da data: "das 10h do dia 05/10", "às 23h59 do dia", "08/11/2026, às 9h". */
function timeNear(line: string, start: number, end: number): string | null {
  const before = line.slice(Math.max(0, start - 20), start);
  const after = line.slice(end, end + 25);
  const match = /(\d{1,2})(?:h(\d{2})?|:(\d{2}))\s*(?:min\s*)?(?:do dia|de)?\s*$/i.exec(before) ?? TIME.exec(after);
  if (!match) return null;
  const hour = Number(match[1]);
  const minutes = Number(match[2] ?? match[3] ?? 0);
  return hour <= 23 && minutes <= 59 ? `${pad(hour)}:${pad(minutes)}` : null;
}

function findDateTokens(line: string): DateToken[] {
  const tokens: DateToken[] = [];
  const taken: [number, number][] = [];
  for (const { pattern, read } of DATE_PATTERNS) {
    for (const match of line.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      const { dates, range } = read(match as RegExpExecArray);
      tokens.push({ index: start, end, dates, range, time: timeNear(line, start, end) });
    }
  }
  return tokens.sort((a, b) => a.index - b.index);
}

/**
 * Data que é referência a lei, portaria ou outro edital ("Lei nº 8.112, de 11
 * de dezembro de 1990", "Edital nº 188/2026, de 22 de julho de 2026",
 * "publicado no Diário Oficial da União de 18/03/2024").
 */
function isReference(line: string, index: number): boolean {
  const before = fold(line.slice(Math.max(0, index - 70), index));
  // O ponto de "8.112" não encerra a referência; o de fim de frase, sim.
  return /(lei|decreto|decreto-lei|portaria|resolucao|edital|oficio|instrucao normativa|medida provisoria|processo|deliberacao)\b(?:[^.;:|]|\.(?=\d)){0,55}$/.test(
    before,
  ) || /(diario oficial|dou|publicad[oa]s?|datad[oa])\s+(da uniao\s+)?(de|em)\s*$/.test(before);
}

// Passos do processo que não viram data do cronograma.
const IGNORE =
  /impugna|restitui|autodeclara|heteroidentifica|pessoas? com deficiencia|\(pcd\)|atendimento (especial|diferenciado)|\bbancas?\b|local e horario|locais de prova|cartao de confirmacao|convoca|publicacao do edital|edital de abertura|lista de candidatos/;

/** Que tipo de data é, pelo texto ao redor (já sem acentos). */
export function classifyDateContext(context: string): DateKind | null {
  // "Resultado dos recursos e do Resultado Final do Concurso": vale o resto da frase.
  const text = fold(context).replace(/resultados? dos recursos|respostas? aos recursos/g, " ");
  if (/isencao/.test(text)) return /resultado|recurso|divulga/.test(text) ? null : "isencao";
  if (IGNORE.test(text)) return null;
  if (/recurso/.test(text)) {
    // Só o recurso contra o gabarito ou o resultado das provas objetivas e do concurso.
    if (/titulos|inscric|isencao/.test(text)) return null;
    return /gabarito|provas? objetivas?|discursiva|resultado (preliminar |final )?do concurso/.test(text) ? "recurso" : null;
  }
  if (/gabarito/.test(text)) return "gabarito";
  if (/inscric(ao|oes)/.test(text) && !/taxa|pagamento|boleto|deferid|homologa|resultado|confer|consulta|valor/.test(text)) {
    return "inscricao_inicio"; // início ou fim: decidido depois, pelas datas
  }
  if (/boleto|pagamento|vencimento|\bgru\b|recolhimento/.test(text)) return "boleto";
  if (
    /homologacao do (resultado|concurso)|resultado (preliminar |final |definitivo )?do concurso/.test(text) ||
    /^\W*resultado final\b(?!\s+d[ao]s?\s)/.test(text)
  ) {
    return "resultado";
  }
  if (/\bprovas?\b|aplicacao/.test(text)) {
    if (/resultado|aplicada aos|realizada em|aptos/.test(text)) return null;
    // "Prova de Títulos" é entrega de documentos; "Prova Didática e Entrega dos Títulos" é prova.
    if (/\btitulos\b/.test(text) && !/didatic|desempenho|escrita|objetiva/.test(text)) return null;
    return "prova";
  }
  if (/validade/.test(text)) return "validade";
  return null;
}

/** Linha só com data (célula de tabela)? Então a etapa está nas linhas da mesma linha da tabela. */
function isDateOnly(line: string, tokens: DateToken[]): boolean {
  let rest = line;
  for (const token of [...tokens].reverse()) rest = rest.slice(0, token.index) + rest.slice(token.end);
  return !/\p{L}{3,}/u.test(rest.replace(/\b(de|a|e|ate|até|das|às|as|h|min|dia|dias|partir)\b/gi, ""));
}

const DATE_HEADER = /^datas?$/;
const LABEL_HEADER = /^(etapas?|atividades?|eventos?|fases?|descri[cç][aã]o)$/;

/**
 * Tabela com a data antes da etapa ("DATA | ETAPA") ou depois ("ATIVIDADES |
 * DATAS")? Os títulos podem estar na mesma linha ou em linhas seguidas.
 * Sem títulos, vale a etapa antes da data, como no texto corrido.
 */
function dateComesFirst(lines: string[]): boolean {
  const cells = lines.map((line) => fold(line).replace(/[|:]/g, " ").trim());
  for (let index = 0; index < cells.length; index++) {
    const words = cells.slice(index, index + 5).flatMap((cell) => cell.split(/\s+/));
    const dateAt = words.findIndex((word) => DATE_HEADER.test(word));
    const labelAt = words.findIndex((word) => LABEL_HEADER.test(word));
    // Só conta se a linha começa por um dos títulos (e não é uma frase qualquer).
    if (dateAt === 0 || labelAt === 0) {
      if (dateAt >= 0 && labelAt >= 0 && cells[index].split(/\s+/).length <= 4) return dateAt < labelAt;
    }
  }
  return false;
}

const hasDate = (line: string) => findDateTokens(line).length > 0;

/**
 * Para uma célula só com a data, o texto da etapa: as linhas da mesma linha da
 * tabela (depois da data, até a próxima data; ou antes dela, desde a anterior).
 */
function rowCells(lines: string[], index: number, dateFirst: boolean): string[] {
  const row: string[] = [];
  const step = dateFirst ? 1 : -1;
  for (let cursor = index + step, count = 0; cursor >= 0 && cursor < lines.length && count < 8; cursor += step, count++) {
    if (hasDate(lines[cursor])) break;
    row.push(lines[cursor]);
  }
  return dateFirst ? row : row.reverse();
}

/** A célula com o nome da etapa: a mais longa, sem contar hora e local. */
function labelCell(cells: string[]): string | null {
  const candidates = cells.filter((cell) => !TIME.test(cell) || /\p{L}{4,}/u.test(cell.replace(TIME, "")));
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** Ano para datas sem ano ("15 de fevereiro"): o mais comum no edital. */
function guessYear(lines: string[], fallback: number): number {
  const counts = new Map<number, number>();
  for (const match of lines.join("\n").matchAll(/\b(20\d\d)\b/g)) {
    const year = Number(match[1]);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  for (const [year, count] of counts) {
    if (count > bestCount || (count === bestCount && year > best)) [best, bestCount] = [year, count];
  }
  return best;
}

const cleanLine = (line: string) => line.replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim();

/** Divide um parágrafo em frases, sem quebrar números como "4.4.3" ou "R$ 1.000,00". */
function sentences(line: string): string[] {
  return line.split(/(?<=[.;])\s+(?=[A-ZÀ-Ú(])/u);
}

export function findNoticeDates(text: string, today: string): NoticeDate[] {
  const currentYear = Number(today.slice(0, 4));
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0);
  const dateFirst = dateComesFirst(lines);
  const defaultYear = guessYear(lines, currentYear);
  const result: NoticeDate[] = [];

  lines.forEach((line, lineIndex) => {
    for (const sentence of sentences(line)) {
      const tokens = findDateTokens(sentence).filter((token) => !isReference(sentence, token.index));
      if (tokens.length === 0) continue;

      let context = sentence;
      let label = sentence;
      let rowTime: string | null = null;
      if (isDateOnly(sentence, tokens)) {
        // Sem pegar a etapa de outra linha da tabela: se esta não interessa, a data fica de fora.
        const cells = rowCells(lines, lineIndex, dateFirst);
        context = cells.join(" ");
        label = labelCell(cells) ?? context;
        const time = TIME.exec(context);
        rowTime = time ? `${pad(Number(time[1]))}:${pad(Number(time[2] ?? time[3] ?? 0))}` : null;
      }
      const kind = classifyDateContext(context);
      if (!kind) continue;

      const dated = tokens.flatMap((token) =>
        token.dates
          .map((raw) => toISO({ ...raw, year: raw.year ?? defaultYear }))
          .filter((iso): iso is string => iso !== null && Number(iso.slice(0, 4)) >= currentYear - 1)
          .map((date) => ({ date, time: token.time ?? rowTime, range: token.range })),
      );
      if (dated.length === 0) continue;
      const first = dated[0];
      const last = dated[dated.length - 1];
      const note = (value: string | null) => value?.slice(0, 200) ?? null;

      switch (kind) {
        case "inscricao_inicio": {
          const folded = fold(context);
          if (dated.length >= 2) {
            result.push({ kind: "inscricao_inicio", date: first.date, time: first.time, note: null });
            result.push({ kind: "inscricao_fim", date: last.date, time: last.time, note: null });
          } else if (/inicio|a partir|abertura|abrem|comecam/.test(folded) && !/ate|termino|encerra|final/.test(folded)) {
            result.push({ kind: "inscricao_inicio", date: first.date, time: first.time, note: null });
          } else {
            result.push({ kind: "inscricao_fim", date: first.date, time: first.time, note: null });
          }
          break;
        }
        case "isencao":
        case "boleto":
          // Vale o prazo final; o período fica na observação.
          result.push({
            kind,
            date: last.date,
            time: last.time,
            note: dated.length >= 2 ? note(`De ${formatShort(first.date)} a ${formatShort(last.date)}`) : null,
          });
          break;
        case "prova":
          for (const item of dated) result.push({ kind, date: item.date, time: item.time, note: note(shortLabel(label)) });
          break;
        default:
          result.push({ kind, date: first.date, time: first.time, note: note(shortLabel(label)) });
      }
    }
  });

  // Sem repetir a mesma data do mesmo tipo: fica a versão com hora e observação.
  const merged = new Map<string, NoticeDate>();
  for (const item of result) {
    const key = `${item.kind}|${item.date}`;
    const current = merged.get(key);
    merged.set(key, current ? { ...current, time: current.time ?? item.time, note: current.note ?? item.note } : item);
  }
  return sortSchedule([...merged.values()]);
}

function formatShort(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "Publicação do Gabarito Preliminar da Prova Objetiva" vira a observação da data. */
function shortLabel(context: string): string | null {
  const label = context
    .replace(/(?<![\d/])\d{1,2}(\/\d{1,2}(\/\d{2,4})?)?/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s|:.,-]+|[\s|:.,-]+$/g, "");
  return label.length > 0 && label.length <= 120 ? label : null;
}

// ---------------------------------------------------------------------------
// Órgão
// ---------------------------------------------------------------------------

const INSTITUTION =
  "tribunal|universidade|instituto|funda[cç][aã]o|conselho|ag[eê]ncia|prefeitura|munic[ií]pio|c[aâ]mara|controladoria|advocacia|defensoria|procuradoria|pol[ií]cia|corpo de bombeiros|banco|empresa|companhia|hospital|assembleia|minist[eé]rio p[uú]blico|departamento|superintend[eê]ncia|caixa|comando|escola|col[eé]gio|centro federal|servi[cç]o|autarquia|senado|tribunal";
const PRIMARY = new RegExp(`^(${INSTITUTION})\\b`, "i");
const SECONDARY = /^(minist[eé]rio|secretaria|governo|estado)\b/i;

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "por"]);
/** Siglas que continuam em maiúsculas ao arrumar um texto todo em maiúsculas. */
const ACRONYMS = new Set([
  "ti", "tic", "ebtt", "sus", "inss", "ibge", "mec", "pcd", "rh", "cgu", "agu", "trt", "trf", "tre", "tst", "stj", "stf",
  "ufms", "ufmg", "ufg", "df", "affc",
]);

/** "TRIBUNAL REGIONAL DO TRABALHO DA 8ª REGIÃO" → "Tribunal Regional do Trabalho da 8ª Região". */
export function titleCase(text: string): string {
  const letters = text.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  if (letters.length === 0 || upper / letters.length < 0.7) return text.trim();
  return text
    .trim()
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, index) => {
      if (/^\s+$/.test(word)) return word;
      if (/^\(?[a-z]{2,6}\)?$/.test(word) && /^\(/.test(word)) return word.toUpperCase(); // (AFFC)
      if (/^(i{1,3}|iv|v|vi{0,3}|ix|x)$/.test(word)) return word.toUpperCase(); // algarismos romanos
      if (ACRONYMS.has(word.replace(/[^\p{L}]/gu, ""))) return word.toUpperCase();
      if (index > 0 && LOWER_WORDS.has(word)) return word;
      return word.replace(/^(\P{L}*)(\p{L})/u, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
    })
    .join("");
}

/** O órgão da linha "Órgão: Ministério da Educação/Universidade Federal de Goiás/...". */
function organFromBreadcrumb(text: string): string | null {
  const match = /^\s*[ÓO]rg[ãa]o:\s*(.+)$/im.exec(text.slice(0, 2000));
  if (!match) return null;
  const parts = match[1].split("/").map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => PRIMARY.test(part)) ?? parts.find((part) => SECONDARY.test(part)) ?? null;
}

/** "A DESEMBARGADORA PRESIDENTE DO TRIBUNAL REGIONAL DO TRABALHO DA 8ª REGIÃO, tendo em vista..." */
function organFromIntro(text: string): string | null {
  const head = text.slice(0, 6000);
  const ending = String.raw`(?:,(?!\s*ci[eê]ncia e tecnologia)|\s+-\s+[A-Z]{2,}|\s+no uso|\s+usando|\s+tendo em vista|\s+torna|\s+faz saber|\s+por meio)`;
  const patterns = [
    new RegExp(String.raw`(?:^|\n|\.\s)(?:O|A)\s+[^\n,]{0,80}?\s+d[oa]s?\s+((?:${INSTITUTION})[^\n]{3,140}?)${ending}`, "i"),
    new RegExp(String.raw`(?:^|\n)(?:O|A)\s+((?:${INSTITUTION})[^\n]{3,140}?)${ending}`, "i"),
    new RegExp(String.raw`\b((?:prefeitura municipal|c[aâ]mara municipal|munic[ií]pio) de [A-ZÀ-Ú][^\n,;.]{2,60})`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(head);
    if (match) return match[1].trim();
  }
  return null;
}

export function findOrgan(text: string): string | null {
  const organ = organFromBreadcrumb(text) ?? organFromIntro(text);
  return organ ? titleCase(organ).slice(0, 160) : null;
}

// ---------------------------------------------------------------------------
// Cargos
// ---------------------------------------------------------------------------

const ROLE_WORDS =
  "analista|t[eé]cnic[oa]|auditor|auditora|professor|professora|assistente|auxiliar|agente|escritur[aá]rio|procurador|especialista|m[eé]dic[oa]|enfermeir[oa]|engenheir[oa]|advogad[oa]|oficial|inspetor|delegad[oa]|perito|perita|escriv[aã]o|investigador|pesquisador|fiscal|contador|psic[oó]log[oa]|assistente social|nutricionista|farmac[eê]utic[oa]|bibliotec[aá]ri[oa]|arquiteto|economista|administrador|motorista|operador|guarda|soldado|policial";

function cleanRole(raw: string): string | null {
  const role = raw
    .replace(/\s*\|.*$/, "")
    .replace(/[:;.,\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const folded = fold(role);
  if (role.length < 4 || role.length > 160) return null;
  if (/ensino (superior|medio|fundamental)|completo|nivel (superior|medio)|^(analista|tecnico)s?$|todas as|valor da/.test(folded)) return null;
  return titleCase(role);
}

export function findRoles(text: string): string[] {
  const found: string[] = [];
  const add = (raw: string) => {
    const role = cleanRole(raw);
    if (role && !found.some((item) => fold(item) === fold(role))) found.push(role);
  };
  // "CARGO 2: AUDITOR FEDERAL DE FINANÇAS E CONTROLE (AFFC) - ESPECIALIDADE: TECNOLOGIA DA INFORMAÇÃO"
  for (const match of text.matchAll(/\bcargo\s*\d+\s*[:–-]\s*([^\n]{3,160})/gi)) add(match[1]);
  // Linhas de tabela que começam pelo cargo ("Analista Judiciário - Área Judiciária")
  for (const match of text.matchAll(new RegExp(String.raw`^\s*\|?\s*((?:${ROLE_WORDS})\b[^\n|]{2,150})`, "gim"))) add(match[1]);
  // "para o cargo de Professor do Magistério Superior"
  if (found.length === 0) {
    for (const match of text.matchAll(
      new RegExp(String.raw`(?:para o cargo de|cargos? de|vagas?(?:\(s\))? de)\s+((?:${ROLE_WORDS})[^\n,.;(]{2,120})`, "gi"),
    )) {
      add(match[1]);
    }
  }
  return found.slice(0, 15);
}

// ---------------------------------------------------------------------------
// Banca, dinheiro, vagas, escolaridade, esfera, local e links
// ---------------------------------------------------------------------------

const EXAM_BOARDS: readonly [string, RegExp][] = [
  ["Cebraspe", /cebraspe|\bcespe\b|centro brasileiro de pesquisa em avaliacao/],
  ["FGV", /\bfgv\b|fundacao getulio vargas/],
  ["FCC", /\bfcc\b|fundacao carlos chagas|concursosfcc/],
  ["Vunesp", /vunesp/],
  ["Fundep", /fundep|gestaodeconcursos/],
  ["IBFC", /\bibfc\b|instituto brasileiro de formacao e capacitacao/],
  ["Consulplan", /consulplan/],
  ["Cesgranrio", /cesgranrio/],
  ["IADES", /\biades\b/],
  ["Quadrix", /quadrix/],
  ["Instituto AOCP", /\baocp\b/],
  ["Idecan", /idecan/],
  ["Ibade", /\bibade\b/],
  ["Fumarc", /fumarc/],
  ["Selecon", /selecon/],
  ["Fundatec", /fundatec/],
  ["IBAM", /\bibam\b/],
  ["Legalle", /legalle/],
  ["Funrio", /funrio/],
  ["Comperve", /comperve/],
  ["IBGP", /\bibgp\b/],
  ["Instituto Access", /instituto access/],
  ["IDIB", /\bidib\b/],
  ["Fafipa", /fafipa/],
  ["Avança SP", /avanca sp/],
  ["Objetiva Concursos", /objetiva concursos/],
];

export function findExamBoard(text: string): string | null {
  const folded = fold(text);
  let best: { name: string; index: number } | null = null;
  for (const [name, pattern] of EXAM_BOARDS) {
    const index = folded.search(pattern);
    if (index >= 0 && (!best || index < best.index)) best = { name, index };
  }
  return best?.name ?? null;
}

const MONEY = String.raw`R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)`;

export function findSalaries(text: string): number[] {
  const values = new Set<number>();
  const pattern = new RegExp(
    String.raw`(remunera[cç][aã]o|vencimento|subs[ií]dio|sal[aá]rio)(?:\s+(?:b[aá]sico|inicial|mensal|base|bruta?))*[^R\n]{0,60}?${MONEY}`,
    "gi",
  );
  for (const match of text.matchAll(pattern)) {
    const cents = parseBRLToCents(match[2]);
    if (cents !== null && cents >= 50_000 && cents <= 10_000_000) values.add(cents);
  }
  return [...values].sort((a, b) => b - a);
}

export function findFee(text: string): number | null {
  const match = new RegExp(String.raw`(?:valor da inscri[cç][aã]o|taxa de inscri[cç][aã]o)[^R\n]{0,40}?${MONEY}`, "i").exec(text);
  const cents = match ? parseBRLToCents(match[1]) : null;
  return cents !== null && cents > 0 && cents <= 100_000 ? cents : null;
}

export function findVacancies(text: string): number | null {
  const head = text.slice(0, 8000);
  const match =
    /(?:provimento de|total de|preenchimento de)\s+(\d{1,5})\s*(?:\([^)]{3,60}\)\s*)?(?:vagas|cargos)/i.exec(head) ??
    /(?<![\d.,])(\d{1,5})\s*(?:\([^)]{3,60}\)\s*)?vagas?\b(?!\s+(?:reservadas|destinadas))/i.exec(head);
  const value = match ? Number(match[1]) : null;
  return value !== null && value > 0 && value <= 100_000 ? value : null;
}

const SUPERIOR_ROLES = /^(analista|auditor|professor|procurador|especialista|medic|enfermeir|engenheir|advogad|delegad|perit|pesquisador|contador|psicolog|nutricionista|farmaceutic|bibliotecari|arquitet|economista|administrador|assistente social)/;

/** Escolaridade pelo cargo escolhido; sem pista no cargo, pela mais alta citada no edital. */
export function findEducation(text: string, role: string | null): EducationLevel | null {
  const folded = fold(role ?? "");
  if (SUPERIOR_ROLES.test(folded)) return "superior";
  const all = fold(text);
  if (/^tecnic/.test(folded)) return /curso tecnico|ensino medio (completo )?e curso tecnico|nivel tecnico/.test(all) ? "tecnico" : "medio";
  if (/^(auxiliar|agente|assistente|escriturari|oficial|motorista|operador|guarda|soldado)/.test(folded)) return "medio";
  if (/nivel superior|ensino superior|graduacao|curso superior/.test(all)) return "superior";
  if (/curso tecnico|nivel tecnico/.test(all)) return "tecnico";
  if (/nivel medio|ensino medio/.test(all)) return "medio";
  if (/ensino fundamental|nivel fundamental/.test(all)) return "fundamental";
  return null;
}

export function findSphere(text: string, organ: string | null): Sphere | null {
  const subject = fold(`${organ ?? ""} ${text.slice(0, 3000)}`);
  const organText = fold(organ ?? "");
  if (/prefeitura|municipio|camara municipal|municipal de/.test(organText)) return "municipal";
  if (/governo do estado|secretaria de estado|assembleia legislativa|estado de |policia militar|policia civil|tribunal de justica|ministerio publico do estado|defensoria publica do estado/.test(organText)) {
    return "estadual";
  }
  if (/federal|da uniao|regional|nacional|ministerio|conselho|controladoria|advocacia-geral|universidade federal|instituto federal/.test(organText)) {
    return "federal";
  }
  if (/prefeitura|municipio de|camara municipal/.test(subject)) return "municipal";
  if (/governo do estado|secretaria de estado/.test(subject)) return "estadual";
  if (/diario oficial da uniao|lei n[ºo°]? 8\.112|uniao/.test(subject)) return "federal";
  return null;
}

/** Cidade e estado só para concursos municipais e estaduais (os federais valem para o país). */
export function findPlace(organ: string | null, sphere: Sphere | null, text: string): { city: string | null; state: UF | null } {
  if (sphere === "municipal" && organ) {
    const match = /(?:[Pp]refeitura [Mm]unicipal|[Cc][aâ]mara [Mm]unicipal|[Mm]unic[ií]pio) de ([A-ZÀ-Ú][\p{L}' -]+?)(?:\s*[-–/]\s*([A-Z]{2}))?$/u.exec(organ);
    if (match) {
      const state = match[2] && isUF(match[2]) ? match[2] : (findUFs(text.slice(0, 3000))[0] ?? null);
      return { city: match[1].trim(), state };
    }
  }
  if (sphere === "estadual") {
    const match = /[Ee]stado d[eoa] ([A-ZÀ-Ú][\p{L} ]+?)(?:[,.\n]|$)/u.exec(`${organ ?? ""}\n${text.slice(0, 3000)}`);
    const state = match ? toUF(match[1]) : null;
    return { city: null, state };
  }
  return { city: null, state: null };
}

/** Links do texto: o da banca ou de inscrição vira o "Ir para a inscrição". */
export function findLinks(text: string): { registrationUrl: string | null; noticeUrl: string | null } {
  const urls = [...text.matchAll(/\b(?:https?:\/\/|www\.)[^\s"'<>|()]+/gi)]
    .map((match) => match[0].replace(/[.,;:]+$/, ""))
    .map((url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`));
  const unique = [...new Set(urls)];
  const registration =
    unique.find((url) => /inscri|concurso|candidato|selecao/i.test(url) && !/\.pdf$/i.test(url)) ??
    unique.find((url) => EXAM_BOARDS.some(([, pattern]) => pattern.test(fold(url)))) ??
    null;
  const notice = unique.find((url) => /\.pdf(\?|$)/i.test(url)) ?? null;
  return { registrationUrl: registration, noticeUrl: notice };
}

// ---------------------------------------------------------------------------
// Tudo junto
// ---------------------------------------------------------------------------

export function parseNotice(text: string, today: string): NoticeReading {
  const organ = findOrgan(text);
  const roles = findRoles(text);
  const sphere = findSphere(text, organ);
  const { city, state } = findPlace(organ, sphere, text);
  const links = findLinks(text);
  return {
    organ,
    roles,
    examBoard: findExamBoard(text),
    salaries: findSalaries(text),
    feeCents: findFee(text),
    vacancies: findVacancies(text),
    reserveList: /cadastro (de )?reserva/i.test(text),
    education: findEducation(text, roles[0] ?? null),
    sphere,
    city,
    state,
    registrationUrl: links.registrationUrl,
    noticeUrl: links.noticeUrl,
    dates: findNoticeDates(text, today),
  };
}

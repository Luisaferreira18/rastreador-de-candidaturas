/**
 * Diário Oficial da União, Seção 3 (onde saem os editais de concurso).
 *
 * Fonte principal: INLABS, da Imprensa Nacional (inlabs.in.gov.br), com o
 * arquivo XML de cada dia. Precisa de cadastro gratuito (INLABS_EMAIL e
 * INLABS_PASSWORD). Reserva automática: a página de Dados Abertos da Imprensa
 * Nacional, com um arquivo por mês, sem login (mais pesado, cerca de 60 MB).
 *
 * De cada matéria do tipo "Edital", só os editais de abertura viram sugestão.
 */

import { unzipSync } from "fflate";
import { findEducation, parseNotice } from "../notice-parser";
import type { Fetcher } from "./http";
import { SourceError } from "./http";
import type { CatalogNotice } from "./types";

export type DouArticle = {
  id: string;
  type: string;
  category: string;
  /** AAAA-MM-DD */
  publishedAt: string | null;
  pdfPage: string | null;
  title: string;
  /** Texto da matéria, com linhas e células de tabela. */
  text: string;
};

const attribute = (xml: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? null;
const cdata = (xml: string, tag: string) => new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(xml)?.[1] ?? "";

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** HTML da matéria em texto, mantendo as linhas e as células das tabelas. */
export function douHtmlToText(html: string): string {
  return decode(
    html
      .replace(/<\/(p|tr|li|h\d|table|div)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
}

export function parseDouXml(xml: string): DouArticle | null {
  const id = attribute(xml, "idMateria") ?? attribute(xml, "id");
  if (!id) return null;
  const date = attribute(xml, "pubDate");
  const [day, month, year] = date?.split("/") ?? [];
  return {
    id,
    type: attribute(xml, "artType") ?? "",
    category: decode(attribute(xml, "artCategory") ?? ""),
    publishedAt: year && month && day ? `${year}-${month}-${day}` : null,
    pdfPage: attribute(xml, "pdfPage")?.replace(/&amp;/g, "&") ?? null,
    title: decode(cdata(xml, "Identifica")).trim(),
    text: douHtmlToText(cdata(xml, "Texto")),
  };
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Edital de abertura de concurso (e não retificação, convocação, resultado...). */
export function isOpeningNotice(article: DouArticle): boolean {
  if (!/^edital/i.test(article.type)) return false;
  const head = fold(`${article.title}\n${article.text.slice(0, 2500)}`);
  if (!/concurso publico/.test(head)) return false;
  if (/retifica|homologa|convoca|resultado|prorroga|complementa|suspens|cancela|sem efeito|nomeia|nomeacao/.test(head.slice(0, 500))) {
    return false;
  }
  return /torna(m)? publica(s)? a (abertura|realizacao)|abertura (das|de) inscricoes|realizacao de concurso publico|estarao abertas as inscricoes|edital de abertura/.test(
    head,
  );
}

/** Edital de abertura no formato do catálogo. */
export function articleToNotice(article: DouArticle, today: string): CatalogNotice {
  const text = `Órgão: ${article.category}\n${article.title}\n${article.text}`;
  const reading = parseNotice(text, today);
  const heading = article.text.split("\n").find((line) => /concurso p[uú]blico/i.test(line) && line.length <= 300) ?? null;
  const organ = reading.organ ?? article.category.split("/").filter(Boolean).pop() ?? "Órgão federal";
  return {
    source: "dou",
    externalId: article.id,
    organ: organ.slice(0, 200),
    title: [article.title, heading].filter(Boolean).join(" · ").slice(0, 300) || null,
    roles: reading.roles.map((title) => ({ title, education: findEducation(text, title) })),
    examBoard: reading.examBoard,
    sphere: reading.sphere ?? "federal",
    salaryCents: reading.salaries[0] ?? null,
    vacancies: reading.vacancies,
    reserveList: reading.reserveList,
    city: reading.city,
    state: reading.state,
    noticeUrl: (article.pdfPage ?? "https://www.in.gov.br/leiturajornal").replace(/^http:/, "https:"),
    registrationUrl: reading.registrationUrl,
    publishedAt: article.publishedAt,
    dates: reading.dates,
    excerpt: article.text.slice(0, 1500),
  };
}

/** XML de dentro do ZIP; com `dates`, só os desses dias (o nome do arquivo traz a data). */
export function unzipArticles(zip: Uint8Array, dates?: ReadonlySet<string>): string[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip, {
      filter: (file) => {
        if (!file.name.toLowerCase().endsWith(".xml")) return false;
        if (!dates) return true;
        const day = /_(\d{4})(\d{2})(\d{2})_/.exec(file.name);
        return day ? dates.has(`${day[1]}-${day[2]}-${day[3]}`) : false;
      },
    });
  } catch {
    throw new SourceError("arquivo do Diário Oficial corrompido");
  }
  const decoder = new TextDecoder("utf-8");
  return Object.values(files).map((bytes) => decoder.decode(bytes));
}

export function noticesFromXmls(xmls: readonly string[], today: string): CatalogNotice[] {
  const notices: CatalogNotice[] = [];
  for (const xml of xmls) {
    const article = parseDouXml(xml);
    if (article && isOpeningNotice(article)) notices.push(articleToNotice(article, today));
  }
  return notices;
}

// ---------------------------------------------------------------------------
// INLABS (com cadastro)
// ---------------------------------------------------------------------------

export const INLABS_URL = "https://inlabs.in.gov.br";
/** Cabeçalho pedido pelos scripts oficiais do INLABS. */
const INLABS_ORIGIN = { origem: "736372697074" };

export async function inlabsLogin(fetcher: Fetcher, email: string, password: string): Promise<string> {
  const cookies = await fetcher.login(`${INLABS_URL}/logar.php`, { email, password }, INLABS_ORIGIN);
  const session = cookies.map((cookie) => cookie.split(";")[0]).find((cookie) => cookie.startsWith("inlabs_session_cookie="));
  if (!session) throw new SourceError("login no INLABS não funcionou (confira o e-mail e a senha, ou o site está em manutenção)");
  return session;
}

export function inlabsZipUrl(date: string): string {
  return `${INLABS_URL}/index.php?p=${date}&dl=${date}-DO3.zip`;
}

async function fromInlabs(fetcher: Fetcher, dates: readonly string[], email: string, password: string): Promise<string[]> {
  const cookie = await inlabsLogin(fetcher, email, password);
  const xmls: string[] = [];
  for (const date of dates) {
    try {
      const zip = await fetcher.bytes(inlabsZipUrl(date), { headers: { Cookie: cookie, ...INLABS_ORIGIN }, maxBytes: 40 * 1024 * 1024 });
      xmls.push(...unzipArticles(zip));
    } catch (error) {
      // Dia sem edição (fim de semana, feriado): segue para o próximo.
      if (!(error instanceof SourceError) || error.message !== "arquivo não encontrado") throw error;
    }
  }
  return xmls;
}

// ---------------------------------------------------------------------------
// Dados Abertos (sem cadastro, um arquivo por mês)
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function openDataPageUrl(year: number, month: number): string {
  return `https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados?ano=${year}&mes=${encodeURIComponent(MONTH_NAMES[month - 1])}`;
}

/** Link do arquivo da Seção 3 do mês ("S03102026.zip" ou "S03102026_Atualizado175812.zip"). */
export function openDataZipLink(html: string, year: number, month: number): string | null {
  const name = `S03${String(month).padStart(2, "0")}${year}`;
  const href = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, "&")).find((link) => link.includes(name) && /\.zip/i.test(link));
  if (!href) return null;
  return href.startsWith("http") ? href : `https://www.in.gov.br${href}`;
}

async function fromOpenData(fetcher: Fetcher, dates: readonly string[]): Promise<string[]> {
  const wanted = new Set(dates);
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
  const xmls: string[] = [];
  for (const yearMonth of months) {
    const [year, month] = yearMonth.split("-").map(Number);
    const page = await fetcher.text(openDataPageUrl(year, month));
    const link = openDataZipLink(page, year, month);
    if (!link) continue; // O arquivo do mês ainda não saiu.
    xmls.push(...unzipArticles(await fetcher.bytes(link), wanted));
  }
  return xmls;
}

/**
 * Editais de abertura publicados nestes dias. Usa o INLABS quando há
 * credenciais; se não houver (ou se ele falhar), os Dados Abertos.
 */
export async function fetchDouNotices(
  fetcher: Fetcher,
  dates: readonly string[],
  today: string,
  credentials: { email: string; password: string } | null,
): Promise<{ notices: CatalogNotice[]; via: "inlabs" | "dados-abertos"; warning: string | null }> {
  if (dates.length === 0) return { notices: [], via: credentials ? "inlabs" : "dados-abertos", warning: null };
  let warning: string | null = null;
  if (credentials) {
    try {
      const xmls = await fromInlabs(fetcher, dates, credentials.email, credentials.password);
      return { notices: noticesFromXmls(xmls, today), via: "inlabs", warning: null };
    } catch (error) {
      warning = `INLABS: ${error instanceof SourceError ? error.message : "falhou"}; usando os Dados Abertos`;
    }
  }
  const xmls = await fromOpenData(fetcher, dates);
  return { notices: noticesFromXmls(xmls, today), via: "dados-abertos", warning };
}

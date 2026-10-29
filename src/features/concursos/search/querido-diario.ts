/**
 * Querido Diário (Open Knowledge Brasil): diários oficiais de municípios, com
 * busca pública e sem cadastro. Usado para os concursos das cidades do perfil.
 *
 * A busca acha a expressão em qualquer parte do diário do dia (que traz
 * licitações, nomeações, convocações...). Por isso cada trecho passa por um
 * filtro: só conta trecho que cita um concurso deste ano ou do próximo
 * ("Concurso Público nº 01/2026") junto de inscrição, isenção ou edital de
 * abertura, e que não é convocação, nomeação, resultado ou gabarito.
 */

import {
  findEducation,
  findExamBoard,
  findLinks,
  findRoles,
  findSalaries,
  findVacancies,
  parseNotice,
} from "../notice-parser";
import type { Fetcher } from "./http";
import { SourceError } from "./http";
import type { CatalogNotice, CityCoverage } from "./types";

/** O endereço "api.queridodiario..." está com o certificado quebrado; este responde. */
export const QD_API = "https://queridodiario.ok.org.br/api";
/** Diário sem nada novo há mais que isso: a cidade está "parada" no Querido Diário. */
const STALE_DAYS = 21;

export type QdCity = { territory_id: string; territory_name: string; state_code: string; level: string };
export type QdGazette = {
  territory_id: string;
  territory_name: string;
  state_code: string;
  date: string;
  url: string | null;
  excerpts: string[];
};

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function parseCities(json: unknown): QdCity[] {
  const cities = (json as { cities?: unknown })?.cities;
  if (!Array.isArray(cities)) throw new SourceError("respondeu num formato inesperado");
  return cities.filter((city): city is QdCity => typeof city?.territory_id === "string" && typeof city?.territory_name === "string");
}

/** "Belo Horizonte/MG" → a cidade do Querido Diário (ou null). */
export function matchCity(place: string, cities: readonly QdCity[]): QdCity | null {
  const [name, uf] = place.split("/").map((part) => part.trim());
  return cities.find((city) => fold(city.territory_name) === fold(name) && (!uf || city.state_code === uf.toUpperCase())) ?? null;
}

/** Situação da cidade: em dia, parada (diários antigos) ou sem diários. */
export function coverageOf(place: string, city: QdCity | null, lastDate: string | null, today: string): CityCoverage {
  if (!city) return { place, status: "nao-encontrada", lastDate: null };
  if (!lastDate) return { place, status: "sem-diarios", lastDate: null };
  const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastDate}T12:00:00Z`)) / 86_400_000;
  return { place, status: age > STALE_DAYS ? "parado" : "em-dia", lastDate };
}

export function gazettesUrl(territoryIds: readonly string[], since: string): string {
  const params = new URLSearchParams({
    published_since: since,
    querystring: '"concurso público" + (inscrição | inscrições | isenção | "edital de abertura")',
    excerpt_size: "1500",
    number_of_excerpts: "5",
    pre_tags: "",
    post_tags: "",
    size: "100",
    sort_by: "descending_date",
  });
  for (const id of territoryIds) params.append("territory_ids", id);
  return `${QD_API}/gazettes?${params}`;
}

export function latestGazetteUrl(territoryId: string): string {
  return `${QD_API}/gazettes?territory_ids=${territoryId}&size=1&sort_by=descending_date`;
}

export function parseGazettes(json: unknown): QdGazette[] {
  const gazettes = (json as { gazettes?: unknown })?.gazettes;
  if (!Array.isArray(gazettes)) throw new SourceError("respondeu num formato inesperado");
  return gazettes.map((gazette) => ({
    territory_id: String(gazette.territory_id ?? ""),
    territory_name: String(gazette.territory_name ?? ""),
    state_code: String(gazette.state_code ?? ""),
    date: String(gazette.date ?? ""),
    url: typeof gazette.url === "string" ? gazette.url : null,
    excerpts: Array.isArray(gazette.excerpts) ? gazette.excerpts.filter((item: unknown) => typeof item === "string") : [],
  }));
}

const CONCURSO_NUMBER = /concurso p[uú]blico(?: municipal)?(?: de provas(?: e t[ií]tulos)?)?\s*(?:n[º°o.]*\s*)?(\d{1,3})\s*\/\s*(20\d\d)/i;
const NOT_OPENING =
  /convoca|nomea|nomeia|homologa|desclassifica|exonera|estagio probatorio|resultado (final|definitivo|preliminar)|gabarito|posse|classificacao final|investigacao social|desistencia/;

/** O trecho fala de um concurso aberto agora? Devolve "número/ano" do concurso. */
export function openConcursoId(excerpt: string, currentYear: number): string | null {
  const match = CONCURSO_NUMBER.exec(excerpt);
  if (!match || Number(match[2]) < currentYear) return null;
  const text = fold(excerpt);
  if (!/inscric|isencao|edital de abertura|abertura d[ao]s? concurso/.test(text)) return null;
  if (NOT_OPENING.test(text)) return null;
  return `${match[1].padStart(2, "0")}/${match[2]}`;
}

/** Prefeitura ou Câmara, com o nome oficial da cidade (do Querido Diário). */
function organOf(text: string, gazette: QdGazette): string {
  return `${/c[aâ]mara municipal/i.test(text) ? "Câmara Municipal" : "Prefeitura Municipal"} de ${gazette.territory_name}`;
}

/** Trecho sobre a inscrição de um concurso, mesmo sem o número ("3.4. Para efetuar sua inscrição..."). */
function isAboutRegistration(excerpt: string): boolean {
  const text = fold(excerpt);
  return /concurso publico/.test(text) && /inscric|isencao/.test(text) && !NOT_OPENING.test(text);
}

/** Os concursos abertos citados num diário (um por número de concurso). */
export function gazetteToNotices(gazette: QdGazette, today: string): CatalogNotice[] {
  const currentYear = Number(today.slice(0, 4));
  const grouped = new Map<string, string[]>();
  for (const excerpt of gazette.excerpts) {
    const id = openConcursoId(excerpt, currentYear);
    if (id) grouped.set(id, [...(grouped.get(id) ?? []), excerpt]);
  }
  if (!gazette.url?.startsWith("http")) return [];
  // Um só concurso aberto no diário: os outros trechos sobre a inscrição são dele (link da banca, datas).
  if (grouped.size === 1) {
    const [id, excerpts] = [...grouped.entries()][0];
    const extra = gazette.excerpts.filter((excerpt) => !excerpts.includes(excerpt) && isAboutRegistration(excerpt));
    grouped.set(id, [...excerpts, ...extra]);
  }

  return [...grouped.entries()].map(([id, excerpts]) => {
    const text = excerpts.join("\n");
    const reading = parseNotice(text, today);
    const roles = findRoles(text);
    return {
      source: "querido_diario",
      externalId: `${gazette.territory_id}:${id}`,
      organ: organOf(text, gazette).slice(0, 200),
      title: `Concurso Público nº ${id}`,
      roles: roles.map((title) => ({ title, education: findEducation(text, title) })),
      examBoard: findExamBoard(text),
      sphere: "municipal",
      salaryCents: findSalaries(text)[0] ?? null,
      vacancies: findVacancies(text),
      reserveList: /cadastro (de )?reserva/i.test(text),
      city: gazette.territory_name,
      state: gazette.state_code,
      noticeUrl: gazette.url!.replace(/^http:/, "https:"),
      registrationUrl: findLinks(text).registrationUrl,
      publishedAt: gazette.date || null,
      dates: reading.dates,
      excerpt: text.replace(/\s+/g, " ").slice(0, 1500),
    } satisfies CatalogNotice;
  });
}

/**
 * Concursos abertos nos diários das cidades do perfil, desde `since`, e a
 * situação de cada cidade no Querido Diário.
 */
export async function fetchQueridoDiario(
  fetcher: Fetcher,
  places: readonly string[],
  since: string,
  today: string,
): Promise<{ notices: CatalogNotice[]; coverage: CityCoverage[] }> {
  if (places.length === 0) return { notices: [], coverage: [] };
  const cities = parseCities(await fetcher.json(`${QD_API}/cities?levels=1&levels=2&levels=3`));
  const matched = places.map((place) => ({ place, city: matchCity(place, cities) }));

  const coverage: CityCoverage[] = [];
  for (const { place, city } of matched) {
    const latest = city ? parseGazettes(await fetcher.json(latestGazetteUrl(city.territory_id)))[0] : undefined;
    coverage.push(coverageOf(place, city, latest?.date ?? null, today));
  }

  const ids = [...new Set(matched.flatMap(({ city }) => (city ? [city.territory_id] : [])))];
  if (ids.length === 0) return { notices: [], coverage };
  const gazettes = parseGazettes(await fetcher.json(gazettesUrl(ids, since)));
  return { notices: gazettes.flatMap((gazette) => gazetteToNotices(gazette, today)), coverage };
}

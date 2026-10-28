/**
 * Estados e cidades do Brasil, para entender o local das vagas
 * ("Sao Paulo, Sao Paulo, Brasil", "Belo Horizonte, MG", "Remoto").
 */

import { fold } from "./text";

export const STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

export type UF = (typeof STATES)[number]["uf"];
export const UF_VALUES = STATES.map((state) => state.uf) as [UF, ...UF[]];

const UF_SET = new Set<string>(UF_VALUES);
const UF_BY_FOLDED_NAME = new Map<string, UF>(STATES.map((state) => [fold(state.name), state.uf]));

export function isUF(value: string | null | undefined): value is UF {
  return typeof value === "string" && UF_SET.has(value);
}

export function stateName(uf: string): string | null {
  return STATES.find((state) => state.uf === uf)?.name ?? null;
}

/** "São Paulo" → "SP"; "SP" → "SP"; desconhecido → null. */
export function toUF(value: string | null | undefined): UF | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isUF(trimmed.toUpperCase()) && trimmed.length === 2) return trimmed.toUpperCase() as UF;
  return UF_BY_FOLDED_NAME.get(fold(trimmed)) ?? null;
}

/** Cidades com muitas vagas: reconhecê-las basta para saber que a vaga é no Brasil (e em que estado). */
const CITY_UF: readonly [string, UF][] = [
  ["sao paulo", "SP"], ["rio de janeiro", "RJ"], ["belo horizonte", "MG"], ["curitiba", "PR"],
  ["porto alegre", "RS"], ["florianopolis", "SC"], ["recife", "PE"], ["salvador", "BA"],
  ["fortaleza", "CE"], ["brasilia", "DF"], ["goiania", "GO"], ["campinas", "SP"], ["manaus", "AM"],
  ["belem", "PA"], ["vitoria", "ES"], ["natal", "RN"], ["joao pessoa", "PB"], ["maceio", "AL"],
  ["aracaju", "SE"], ["teresina", "PI"], ["sao luis", "MA"], ["cuiaba", "MT"], ["campo grande", "MS"],
  ["palmas", "TO"], ["osasco", "SP"], ["barueri", "SP"], ["santos", "SP"], ["sorocaba", "SP"],
  ["ribeirao preto", "SP"], ["sao jose dos campos", "SP"], ["joinville", "SC"], ["blumenau", "SC"],
  ["londrina", "PR"], ["maringa", "PR"], ["uberlandia", "MG"], ["juiz de fora", "MG"], ["niteroi", "RJ"],
  ["santo andre", "SP"], ["sao bernardo do campo", "SP"], ["guarulhos", "SP"], ["jundiai", "SP"],
  ["piracicaba", "SP"], ["contagem", "MG"], ["betim", "MG"], ["caxias do sul", "RS"], ["alphaville", "SP"],
  ["sao caetano do sul", "SP"],
];

/** Sinais de vaga fora do Brasil (testados depois das cidades brasileiras). */
const FOREIGN_MARKERS = [
  "mexico", "colombia", "bogota", "medellin", "argentina", "buenos aires", "chile", "santiago",
  "peru", "lima", "uruguay", "uruguai", "montevideo", "usa", "united states", "estados unidos",
  "new york", "miami", "florida", "california", "san francisco", "seattle", "austin", "boston",
  "london", "uk", "united kingdom", "ireland", "dublin", "germany", "berlin", "munich", "spain",
  "madrid", "barcelona", "portugal", "lisbon", "lisboa", "france", "paris", "netherlands",
  "amsterdam", "singapore", "india", "bangalore", "canada", "toronto", "japan", "tokyo",
  "australia", "sydney", "poland", "warsaw", "israel", "tel aviv", "philippines", "manila",
];

function containsWord(haystack: string, needle: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${needle.replace(/ /g, "\\s+")}($|[^a-z0-9])`).test(haystack);
}

/**
 * Estados citados no local da vaga: "Belo Horizonte, MG", "Sao Paulo, Sao Paulo, Brasil",
 * "Curitiba | On-site" (pela cidade).
 */
export function findUFs(location: string): UF[] {
  const found = new Set<UF>();
  for (const match of location.matchAll(/(?:^|[\s,/(\-|])([A-Z]{2})(?=$|[\s,/)\-|;.])/g)) {
    if (isUF(match[1])) found.add(match[1]);
  }
  const folded = fold(location);
  for (const state of STATES) {
    if (state.name.length > 4 && containsWord(folded, fold(state.name))) found.add(state.uf);
  }
  for (const [city, uf] of CITY_UF) if (containsWord(folded, city)) found.add(uf);
  return [...found];
}

/**
 * Estados citados no título, só nos formatos usados para local
 * ("Híbrido/SP", "(RJ)", "| MG"), para não confundir palavras em maiúsculas.
 */
export function findUFsInTitle(title: string): UF[] {
  const found = new Set<UF>();
  for (const match of title.matchAll(/(?:\/|\(|\|\s?|-\s)([A-Z]{2})(?=\)|$|\s|\|)/g)) {
    if (isUF(match[1])) found.add(match[1]);
  }
  return [...found];
}

/** Estado de uma cidade conhecida ("Curitiba" → "PR"). */
export function ufOfCity(city: string): UF | null {
  const folded = fold(city).trim();
  return CITY_UF.find(([name]) => name === folded)?.[1] ?? null;
}

/** Cidades conhecidas citadas no texto ("Belo Horizonte, MG; São Paulo, SP" → as duas). */
export function findCities(text: string): string[] {
  const folded = fold(text);
  return CITY_UF.filter(([city]) => containsWord(folded, city)).map(([city]) => city);
}

/**
 * A vaga é no Brasil? true = sim; false = claramente em outro país;
 * null = não dá para saber (ex.: só "Remote").
 */
export function isBrazilLocation(location: string | null, country: string | null = null): boolean | null {
  if (country) return country.toUpperCase() === "BR";
  if (!location) return null;
  const text = fold(location);
  if (/\b(brasil|brazil|latam|latin america|america latina)\b/.test(text)) return true;
  if (CITY_UF.some(([city]) => containsWord(text, city))) return true;
  if (/\bremoto\b|\bhibrido\b|\bpresencial\b/.test(text)) return true;
  if (FOREIGN_MARKERS.some((marker) => containsWord(text, marker))) return false;
  if (findUFs(location).length > 0) return true;
  return null;
}

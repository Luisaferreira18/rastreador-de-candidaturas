/**
 * Datas e valores no padrão brasileiro.
 *
 * Datas "puras" (colunas `date` do banco) chegam como "AAAA-MM-DD" e são
 * tratadas como texto/UTC para não sofrerem com fuso horário. Datas com hora
 * (timestamptz) são exibidas sempre no fuso de São Paulo, então o resultado é
 * o mesmo no servidor (UTC na Vercel) e no navegador.
 */

export const TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data de hoje ("AAAA-MM-DD") no fuso de São Paulo. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isoToUTCDate(iso: string): Date {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Data inválida: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function isValidISODate(iso: string): boolean {
  const match = ISO_DATE.exec(iso);
  if (!match) return false;
  const date = isoToUTCDate(iso);
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}

export function addDaysISO(iso: string, days: number): string {
  const date = isoToUTCDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Quantos dias de `from` até `to` (positivo se `to` for depois). */
export function diffDaysISO(from: string, to: string): number {
  return Math.round((isoToUTCDate(to).getTime() - isoToUTCDate(from).getTime()) / 86_400_000);
}

/** Converte um timestamp em data ("AAAA-MM-DD") no fuso de São Paulo. */
export function timestampToISODate(timestamp: string | Date): string {
  return todayISO(typeof timestamp === "string" ? new Date(timestamp) : timestamp);
}

/** "19/10/2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC" }).format(isoToUTCDate(iso));
}

/** "19 de out. de 2026" */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(isoToUTCDate(iso));
}

/** "19 out." (sem o ano) */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short" })
    .format(isoToUTCDate(iso))
    .replace(" de ", " ");
}

/** "19/10/2026, 14:30" no fuso de São Paulo. */
export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

/** "hoje", "amanhã", "em 3 dias", "há 2 dias"... */
export function formatRelativeDay(iso: string, today: string): string {
  return relativeFormatter.format(diffDaysISO(today, iso), "day");
}

/** "1 dia", "12 dias" */
export function formatDayCount(days: number): string {
  return days === 1 ? "1 dia" : `${days} dias`;
}

const currencyFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" });

/** 180050 → "R$ 1.800,50" */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return currencyFormatter.format(cents / 100);
}

/** 180000 → "R$ 1.800" (sem centavos quando são zero; para cards e tabelas) */
export function formatCurrencyCompact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const formatted = formatCurrency(cents);
  return cents % 100 === 0 ? formatted.replace(/,00$/, "") : formatted;
}

/** 180050 → "1.800,50" (para preencher o campo do formulário) */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    cents / 100,
  );
}

/**
 * Lê um valor digitado em reais e devolve centavos.
 * Aceita "1800", "1.800", "1.800,50", "R$ 1.800,50" e "1800.50".
 * Devolve `null` se o texto não for um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  let value = input.replace(/R\$/gi, "").replace(/\s| /g, "");
  if (value === "") return null;

  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(value)) {
    value = value.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export function formatPercent(value: number | null, fractionDigits = 0): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

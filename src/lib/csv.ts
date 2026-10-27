/**
 * Geração de CSV compatível com o Excel em português:
 * separador ";" e BOM UTF-8 para os acentos aparecerem certos.
 */

export const CSV_SEPARATOR = ";";
const BOM = "﻿";

/**
 * Escapa um campo. Também neutraliza "injeção de fórmula": textos que começam
 * com = + - @ viram texto puro (prefixo ') para o Excel não executá-los.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(CSV_SEPARATOR));
  return BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Texto do PDF do currículo, com a biblioteca unpdf (o pdf.js da Mozilla
 * empacotado para rodar no servidor, sem dependências nativas).
 */

import { extractText, getDocumentProxy } from "unpdf";

/** Currículo com mais páginas que isso provavelmente não é um currículo. */
export const MAX_PAGES = 10;

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfError";
  }
}

/** Todo PDF começa com "%PDF-" (o tipo informado pelo navegador não basta). */
export function isPdf(bytes: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return bytes.length > signature.length && signature.every((byte, index) => bytes[index] === byte);
}

/** Texto do PDF. Currículos têm poucas páginas; editais podem ter mais de cem (`maxPages`). */
export async function readPdfText(bytes: Uint8Array, { maxPages = MAX_PAGES }: { maxPages?: number } = {}): Promise<string> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // Cópia: o pdf.js transfere o buffer recebido e o deixa vazio.
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new PdfError("Não foi possível abrir esse PDF. Ele pode estar corrompido ou protegido por senha.");
  }
  try {
    if (pdf.numPages > maxPages) {
      throw new PdfError(
        maxPages === MAX_PAGES
          ? `O currículo pode ter no máximo ${MAX_PAGES} páginas.`
          : `Esse PDF tem mais de ${maxPages} páginas. Copie e cole só a parte do edital que interessa.`,
      );
    }
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

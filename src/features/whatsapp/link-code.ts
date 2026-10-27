import { createHash, randomInt } from "node:crypto";

/** Sem letras e números que se confundem (I, O, 0, 1). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LINK_CODE_TTL_MINUTES = 15;

/** Código para provar que o número é seu: "RDC-7K4P2Q". */
export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `RDC-${code}`;
}

export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/** Acha "vincular RDC-XXXXXX" na mensagem (aceita minúsculas e espaços extras). */
export function extractLinkCode(text: string): string | null {
  const match = /\bvincular\s+(rdc-[a-z0-9]{6})\b/i.exec(text);
  return match ? match[1].toUpperCase() : null;
}

/** "5511987654321" → "+55 11 9****-4321" */
export function maskPhone(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.length < 8) return "número vinculado";
  const country = digits.slice(0, 2);
  const area = digits.slice(2, 4);
  const last = digits.slice(-4);
  return `+${country} ${area} ${digits.length > 12 ? "9" : ""}****-${last}`;
}

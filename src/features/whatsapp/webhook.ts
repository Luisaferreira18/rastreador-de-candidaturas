import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingWhatsAppMessage } from "./assistant";

/**
 * Confere se a notificação veio mesmo da Meta: o cabeçalho
 * X-Hub-Signature-256 traz um HMAC-SHA256 do corpo com o App Secret.
 */
export function isValidSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = header.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

type WebhookBody = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
};

/** Extrai as mensagens de texto da notificação (ignora status de entrega e outros tipos). */
export function extractTextMessages(body: unknown): {
  texts: IncomingWhatsAppMessage[];
  others: { id: string; from: string }[];
} {
  const texts: IncomingWhatsAppMessage[] = [];
  const others: { id: string; from: string }[] = [];
  const data = body as WebhookBody;
  if (data?.object !== "whatsapp_business_account") return { texts, others };

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from) continue;
        if (message.type === "text" && message.text?.body) {
          texts.push({ id: message.id, from: message.from, text: message.text.body.slice(0, 8000) });
        } else {
          others.push({ id: message.id, from: message.from });
        }
      }
    }
  }
  return { texts, others };
}

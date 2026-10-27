/**
 * Configuração do assistente do WhatsApp (API oficial da Meta).
 * Sem WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID, as respostas não são enviadas:
 * ficam só no log ("modo de teste"), útil para desenvolver.
 */

export type WhatsAppConfig = {
  verifyToken: string;
  appSecret: string;
  botNumber: string;
  accessToken: string | null;
  phoneNumberId: string | null;
  apiVersion: string;
  dryRun: boolean;
};

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const botNumber = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER?.replace(/\D/g, "");
  // O assistente lê e grava dados de quem manda mensagem: precisa da chave secreta.
  if (!verifyToken || !appSecret || !botNumber || !process.env.SUPABASE_SECRET_KEY) return null;

  const accessToken = process.env.WHATSAPP_TOKEN || null;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null;
  return {
    verifyToken,
    appSecret,
    botNumber,
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
    dryRun: !accessToken || !phoneNumberId,
  };
}

/** Número do bot, para o link wa.me (só o que é público). */
export function getPublicBotNumber(): string | null {
  return process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER?.replace(/\D/g, "") || null;
}

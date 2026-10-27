import { NextResponse, type NextRequest } from "next/server";
import { handleIncomingMessage } from "@/features/whatsapp/assistant";
import { getWhatsAppConfig } from "@/features/whatsapp/config";
import { createAssistantDeps } from "@/features/whatsapp/deps";
import { extractTextMessages, isValidSignature } from "@/features/whatsapp/webhook";
import { todayISO } from "@/lib/format";

/**
 * Webhook do WhatsApp (API oficial da Meta).
 * GET: verificação feita pela Meta ao cadastrar o webhook.
 * POST: mensagens recebidas. Só responde a quem escreveu (grátis dentro da
 * cota mensal da Meta); nunca inicia conversas.
 */
export async function GET(request: NextRequest) {
  const config = getWhatsAppConfig();
  if (!config) return NextResponse.json({ error: "WhatsApp não configurado." }, { status: 404 });

  const params = request.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === config.verifyToken) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Token de verificação inválido." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const config = getWhatsAppConfig();
  if (!config) return NextResponse.json({ error: "WhatsApp não configurado." }, { status: 404 });

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { texts, others } = extractTextMessages(body);
  const deps = createAssistantDeps(config);
  const ctx = { appUrl: (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, ""), today: todayISO() };
  const replies: { to: string; text: string }[] = [];

  for (const message of texts) {
    try {
      const reply = await handleIncomingMessage(deps, message, ctx);
      if (reply) replies.push({ to: message.from, text: reply });
    } catch (error) {
      // Responde 200 mesmo assim: senão a Meta reenvia a mesma mensagem várias vezes.
      console.error("[whatsapp]", error);
    }
  }
  for (const message of others) {
    try {
      if (await deps.markProcessed(message.id)) {
        await deps.send(message.from, "Por enquanto eu entendo só mensagens de texto. Mande *menu* para ver o que sei fazer.");
      }
    } catch (error) {
      console.error("[whatsapp]", error);
    }
  }

  // No modo de teste (sem as chaves de envio da Meta), devolve as respostas para conferir.
  return NextResponse.json({ ok: true, ...(config.dryRun ? { respostas: replies } : {}) });
}

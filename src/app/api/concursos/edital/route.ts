import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { NoticeFetchError, fetchNoticeText } from "@/features/concursos/notice-fetch";
import type { NoticeReadResponse } from "@/features/concursos/notice-form";
import { findEducation, parseNotice } from "@/features/concursos/notice-parser";
import { todayISO } from "@/lib/format";
import { normalizeUrl } from "@/lib/url";

/** Baixar e ler um edital longo em PDF leva alguns segundos. */
export const maxDuration = 60;

/** Um edital inteiro cabe com folga (os maiores têm umas 300 mil letras). */
const MAX_TEXT = 600_000;

const bodySchema = z.union([
  z.object({ text: z.string().trim().min(200, "Cole o texto do edital (pelo menos um parágrafo).").max(MAX_TEXT, "Esse texto é longo demais. Cole só a parte que interessa.") }),
  z.object({ url: z.string().trim().min(4, "Cole o link do edital.").max(2048, "Esse link é longo demais.") }),
]);

const reply = (body: NoticeReadResponse, status = 200) => NextResponse.json(body, { status });

/**
 * POST /api/concursos/edital: lê o edital colado ({ text }) ou baixado do link
 * ({ url }) e devolve as sugestões para o formulário. Nada é salvo aqui.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply({ status: "erro", message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return reply({ status: "erro", message: parsed.error.issues[0]?.message ?? "Envie o texto ou o link do edital." }, 400);
  }

  let text: string;
  let source: { url: string | null; isPdf: boolean };
  if ("text" in parsed.data) {
    text = parsed.data.text;
    source = { url: null, isPdf: false };
  } else {
    try {
      const fetched = await fetchNoticeText(normalizeUrl(parsed.data.url));
      text = fetched.text.slice(0, MAX_TEXT);
      source = { url: fetched.url, isPdf: fetched.isPdf };
    } catch (error) {
      if (error instanceof NoticeFetchError) return reply({ status: "erro", message: error.message }, 422);
      console.error("[concursos/edital]", error);
      return reply({ status: "erro", message: "Não foi possível baixar o edital. Copie e cole o texto." }, 502);
    }
  }

  if (text.replace(/\s+/g, "").length < 200) {
    return reply(
      {
        status: "erro",
        message:
          "Quase não há texto nesse endereço. Algumas páginas de bancas montam o conteúdo só no navegador: abra o edital e cole o link do PDF (termina em .pdf) ou o texto. PDF escaneado também não tem texto para ler.",
      },
      422,
    );
  }

  const reading = parseNotice(text, todayISO());
  return reply({
    status: "ok",
    reading,
    educationByRole: reading.roles.map((role) => findEducation(text, role)),
    source: { ...source, chars: text.length },
  });
}

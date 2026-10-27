import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { buildIngestRows, emailBatchSchema } from "@/features/inbox/ingest";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * POST /api/inbox/email: recebe e-mails do script do Google (com o token
 * pessoal no cabeçalho), interpreta cada um e grava as sugestões.
 *
 * Não usa sessão nem chave secreta: a função inbox_ingest do banco confere o
 * token e só grava na conta dona dele.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Envie o token no cabeçalho Authorization." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }
  const batch = emailBatchSchema.safeParse(json);
  if (!batch.success) {
    return NextResponse.json({ error: "Formato inválido: envie { emails: [...] } com até 50 mensagens." }, { status: 400 });
  }

  const rows = buildIngestRows(batch.data);
  if (rows.length === 0) {
    return NextResponse.json({ recebidos: batch.data.emails.length, relevantes: 0, gravados: 0 });
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("inbox_ingest", { p_token: token, p_items: rows });

  if (error) {
    if (error.code === "28000") return NextResponse.json({ error: "Token inválido. Gere um novo no app." }, { status: 401 });
    console.error("[inbox/email]", error);
    return NextResponse.json({ error: "Não foi possível gravar as mensagens." }, { status: 500 });
  }

  return NextResponse.json({ recebidos: batch.data.emails.length, relevantes: rows.length, gravados: data ?? 0 });
}

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Retorno dos links de e-mail (confirmação de cadastro, recuperação de senha)
 * e do login com Google. Troca o código por uma sessão e segue para `next`.
 *
 * Aceita os dois formatos do Supabase:
 * - `?code=...` (padrão, fluxo PKCE);
 * - `?token_hash=...&type=...` (se você personalizar os modelos de e-mail).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback]", error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback]", error);
  }

  const failure = new URL("/login", origin);
  failure.searchParams.set("erro", "link");
  return NextResponse.redirect(failure);
}

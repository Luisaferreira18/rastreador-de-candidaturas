"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyAuthError, success, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getDemoCredentials } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  resetRequestSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
  type NewPasswordValues,
  type ResetRequestValues,
  type SignInValues,
  type SignUpValues,
} from "./schema";

/** Endereço do site, para os links de e-mail e o retorno do Google. */
async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signIn(values: SignInValues, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return failure(friendlyAuthError(error));

  redirect(safeNextPath(next));
}

export async function signUp(
  values: SignUpValues,
): Promise<ActionResult<{ needsConfirmation: boolean; email: string }>> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/painel`,
    },
  });
  if (error) return failure(friendlyAuthError(error));

  // Com "Confirm email" desligado no Supabase, a sessão já vem pronta.
  if (data.session) redirect("/painel");

  // Com a confirmação ligada, um e-mail já cadastrado volta sem identidades.
  if (data.user && data.user.identities?.length === 0) {
    return failure("Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.");
  }
  return success({ needsConfirmation: true, email: parsed.data.email });
}

export async function signInWithGoogle(next?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}` },
  });
  if (error || !data.url) return failure(friendlyAuthError(error));

  redirect(data.url);
}

export async function signInAsDemo(): Promise<ActionResult> {
  const credentials = getDemoCredentials();
  if (!credentials) return failure("A conta de demonstração não está configurada neste ambiente.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    console.error("[demo]", error);
    return failure(
      "Não foi possível abrir a demonstração agora. Tente de novo em alguns minutos.",
    );
  }

  redirect("/painel");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(values: ResetRequestValues): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success) return failure("Revise o e-mail.", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/redefinir-senha`,
  });
  // Por segurança, a resposta é a mesma exista ou não uma conta com esse e-mail.
  if (error && error.code !== "user_not_found") return failure(friendlyAuthError(error));
  return success();
}

export async function updatePassword(values: NewPasswordValues): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return failure("Revise os campos destacados.", zodFieldErrors(parsed.error));

  const user = await getCurrentUser();
  if (!user) return failure("O link expirou. Peça um novo e-mail de recuperação.");
  if (user.isDemo) return failure("A senha da conta de demonstração não pode ser alterada.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure(friendlyAuthError(error));

  redirect("/painel");
}

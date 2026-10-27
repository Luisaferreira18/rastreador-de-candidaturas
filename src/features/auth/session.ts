import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isDemoEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isDemo: boolean;
};

/**
 * Usuário logado (ou `null`). Valida o token com getClaims(), que confere a
 * assinatura do JWT; nunca confie só no cookie de sessão no servidor.
 * O `cache` do React evita repetir a leitura na mesma renderização.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const claims = data.claims;
  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : null;
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  return { id: claims.sub, email, name, avatarUrl, isDemo: isDemoEmail(email) };
});

/** Exige login: redireciona para /login se não houver sessão. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

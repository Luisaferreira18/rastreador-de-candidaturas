/** Leitura centralizada das variáveis de ambiente, com mensagens de erro claras. */

export class MissingEnvError extends Error {
  constructor(names: string[]) {
    super(
      `Configuração incompleta: defina ${names.join(", ")} no arquivo .env.local ` +
        "(veja o .env.example e a seção \"Configurar o Supabase\" do README).",
    );
    this.name = "MissingEnvError";
  }
}

export function getSupabasePublicEnv() {
  // Acessos literais: o Next.js só embute variáveis NEXT_PUBLIC_ escritas assim.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean) as string[];
  if (missing.length > 0) throw new MissingEnvError(missing);
  return { url: url!, publishableKey: publishableKey! };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

/** Credenciais da conta de demonstração (só no servidor). */
export function getDemoCredentials(): { email: string; password: string } | null {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function isDemoEmail(email: string | null | undefined): boolean {
  const demoEmail = process.env.DEMO_EMAIL;
  return Boolean(email && demoEmail && email.toLowerCase() === demoEmail.toLowerCase());
}

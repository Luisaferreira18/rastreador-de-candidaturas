import type { z } from "zod";

/** Resultado padrão das Server Actions: nunca lança erro para o cliente. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function success<T>(data: T): ActionResult<T>;
export function success(): ActionResult<undefined>;
export function success<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function failure(error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors };
}

/** Converte os erros do Zod em { campo: "mensagem" } (primeira mensagem de cada campo). */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Traduz erros do Supabase/PostgreSQL em mensagens claras para quem usa o app.
 * O erro original vai para o log do servidor.
 */
export function friendlyDbError(rawError: unknown, fallback = "Não foi possível salvar. Tente novamente."): string {
  if (!rawError) return fallback;
  console.error("[supabase]", rawError);
  const error = rawError as { code?: string; message?: string };

  switch (error.code) {
    case "PGRST116":
      return "Não encontramos essa candidatura. Ela pode ter sido excluída.";
    case "42501":
      return "Você não tem permissão para fazer isso. Entre novamente e tente de novo.";
    case "23514":
      return "Algum valor está fora do permitido. Revise os campos e tente de novo.";
    case "23503":
      return "Essa candidatura não existe mais. Atualize a página.";
    case "22P02":
      return "Identificador inválido.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre novamente.";
  }

  if (error.message?.toLowerCase().includes("fetch failed")) {
    return "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";
  }
  return fallback;
}

/** Mensagens de erro do login (Supabase Auth) em português. */
export function friendlyAuthError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Algo deu errado. Tente novamente.";
  const code = error.code ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (code === "invalid_credentials" || message.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada (e no spam).";
  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered"))
    return "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.";
  if (code === "weak_password" || message.includes("password should be"))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || message.includes("rate limit"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (code === "same_password") return "A nova senha precisa ser diferente da atual.";
  if (code === "validation_failed" || message.includes("invalid email")) return "E-mail inválido.";
  if (code === "provider_disabled" || message.includes("provider is not enabled"))
    return "O login com Google ainda não foi ativado no Supabase.";
  if (message.includes("fetch failed"))
    return "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";

  console.error("[auth]", error);
  return "Algo deu errado. Tente novamente.";
}

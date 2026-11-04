/**
 * Configuração do Sentry, igual no navegador e no servidor. O app só carrega o
 * SDK quando SENTRY_DSN está configurado, e nada de dados pessoais sai daqui:
 * sem IP, cookies, cabeçalhos, corpo, parâmetros de URL nem histórico de ações,
 * e o texto dos erros passa por uma máscara.
 */

import type { ErrorEvent } from "@sentry/nextjs";

const MASKS: [RegExp, string][] = [
  // Chaves e tokens vêm primeiro: podem conter trechos parecidos com os outros padrões.
  [/\b(?:sb_secret_|sb_publishable_|sbp_)[\w-]+/g, "[chave]"],
  [/\bBearer\s+[\w.~+/-]+=*/gi, "Bearer [token]"],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]"],
  [/(?<![\w.-])(?:\+?55[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}\b/g, "[telefone]"],
];

/** Esconde e-mails, CPFs, telefones e chaves de um texto. */
export function maskPersonalData(text: string): string {
  return MASKS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text);
}

/** Tira a parte da URL que pode ter dados da pessoa (parâmetros e âncora). */
function stripUrl(url: string): string {
  return maskPersonalData(url.split(/[?#]/, 1)[0]);
}

/** Último filtro antes do envio. Exportado para os testes. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.server_name;
  if (event.request) event.request = event.request.url ? { url: stripUrl(event.request.url) } : {};
  if (event.message) event.message = maskPersonalData(event.message);
  if (event.logentry) event.logentry = { message: maskPersonalData(event.logentry.message ?? "") };
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = maskPersonalData(exception.value);
  }
  return event;
}

export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    // Só erros: sem medição de desempenho nem gravação de sessão, que gastam a cota grátis.
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  };
}

/**
 * Avisa o Sentry de um erro pego por uma tela de erro do navegador. Erros com
 * `digest` vieram do servidor, que já avisou.
 */
export function reportClientError(error: unknown) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || (typeof error === "object" && error !== null && "digest" in error)) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
}

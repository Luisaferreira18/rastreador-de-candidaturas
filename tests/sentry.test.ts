import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maskPersonalData, scrubEvent, sentryOptions } from "@/lib/sentry";

const init = vi.fn();
const captureRequestError = vi.fn();
vi.mock("@sentry/nextjs", () => ({ init, captureRequestError, captureConsoleIntegration: () => ({ name: "CaptureConsole" }) }));

describe("o que vai para o Sentry", () => {
  it("esconde e-mail, CPF, telefone e chaves do texto dos erros", () => {
    expect(maskPersonalData("Falha para ana.lima+vagas@gmail.com")).toBe("Falha para [e-mail]");
    expect(maskPersonalData("CPF 123.456.789-09 recusado")).toBe("CPF [CPF] recusado");
    expect(maskPersonalData("WhatsApp 5511987654321 e (11) 98765-4321")).toBe("WhatsApp [telefone] e [telefone]");
    expect(maskPersonalData("chave sb_secret_abc-123 e Bearer abc.def")).toBe("chave [chave] e Bearer [token]");
    expect(maskPersonalData("token eyJhbGci.eyJzdWIi.c2lnbmF0dXJl")).toBe("token [token]");
  });

  it("não estraga ids, datas, valores nem caminhos", () => {
    const text = "GET /concursos/c08a9b7c-a142-405d-9f2a-df4854b9d406 em 2026-11-04: 2392 vagas, status 500";
    expect(maskPersonalData(text)).toBe(text);
  });

  it("tira pessoa, cookies, cabeçalhos, corpo, parâmetros e histórico do evento", () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: "u1", email: "ana@gmail.com", ip_address: "200.1.2.3" },
      server_name: "maquina",
      extra: { arguments: ["ana@gmail.com"] },
      breadcrumbs: [{ message: "clicou" }],
      message: "erro de ana@gmail.com",
      request: {
        url: "https://app.dev/concursos?busca=ana@gmail.com#topo",
        cookies: { sessao: "abc" },
        headers: { authorization: "Bearer abc" },
        data: { senha: "123" },
        query_string: "busca=ana@gmail.com",
      },
      exception: { values: [{ type: "Error", value: "falhou para ana@gmail.com" }] },
    } as ErrorEvent);

    expect(event).toEqual({
      type: undefined,
      message: "erro de [e-mail]",
      request: { url: "https://app.dev/concursos" },
      exception: { values: [{ type: "Error", value: "falhou para [e-mail]" }] },
    });
  });

  it("não coleta dados pessoais nem medições", () => {
    expect(sentryOptions("https://chave@sentry.example/1")).toMatchObject({
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
      beforeSend: scrubEvent,
    });
  });
});

describe("só liga com o SENTRY_DSN", () => {
  const original = process.env.SENTRY_DSN;
  const context = { routerKind: "App Router", routePath: "/painel", routeType: "render", revalidateReason: undefined } as const;
  const request = { path: "/painel", method: "GET", headers: {} };

  beforeEach(() => {
    init.mockClear();
    captureRequestError.mockClear();
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = original;
  });

  it("sem a variável, nada é iniciado nem enviado", async () => {
    delete process.env.SENTRY_DSN;
    const { register, onRequestError } = await import("@/instrumentation");
    await register();
    await onRequestError?.(new Error("x"), request, context);
    expect(init).not.toHaveBeenCalled();
    expect(captureRequestError).not.toHaveBeenCalled();
  });

  it("com a variável, inicia e avisa dos erros do servidor", async () => {
    process.env.SENTRY_DSN = "https://chave@sentry.example/1";
    const { register, onRequestError } = await import("@/instrumentation");
    await register();
    await onRequestError?.(new Error("x"), request, context);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ dsn: "https://chave@sentry.example/1", sendDefaultPii: false }));
    expect(captureRequestError).toHaveBeenCalledOnce();
  });
});

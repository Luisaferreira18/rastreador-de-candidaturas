import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectCommand,
  findCompanyInText,
  handleIncomingMessage,
  type AssistantDeps,
} from "@/features/whatsapp/assistant";
import { extractLinkCode, generateLinkCode, hashLinkCode, maskPhone } from "@/features/whatsapp/link-code";
import { extractTextMessages, isValidSignature } from "@/features/whatsapp/webhook";
import type { ReportSnapshot } from "@/features/report/build";

const TODAY = "2026-10-20";
const ctx = { appUrl: "https://rastreador.app", today: TODAY };
const ANA = "5511999990000";

const snapshot: ReportSnapshot = {
  applications: [
    { id: "a1", company: "Nuvem Pay", role_title: "Estágio em Dados", stage: "entrevista_rh", platform: "gupy", stage_changed_at: "2026-10-18T13:00:00Z", applied_at: "2026-09-29", created_at: "2026-09-29T13:00:00Z" },
    { id: "a2", company: "Banco Aurora", role_title: "Estágio em Software", stage: "entrevista_tecnica", platform: "gupy", stage_changed_at: "2026-10-16T13:00:00Z", applied_at: "2026-09-22", created_at: "2026-09-22T13:00:00Z" },
    { id: "a3", company: "Rota", role_title: "Estágio em TI", stage: "reprovada", platform: "gupy", stage_changed_at: "2026-09-01T13:00:00Z", applied_at: "2026-08-20", created_at: "2026-08-20T13:00:00Z" },
  ],
  history: [],
  tasks: [{ application_id: "a1", title: "Preparar perguntas", due_date: "2026-10-21" }],
  pendingSuggestions: 1,
  newLeads: [],
  newLeadsCount: 0,
  concursos: [{ id: "c1", organ: "Agência Nacional de Dados", role_title: "Analista de TI", stage: "edital_publicado" }],
  concursoDates: [
    { concurso_id: "c1", kind: "inscricao_fim", date: "2026-10-23", time: null },
    { concurso_id: "c1", kind: "prova", date: "2026-11-15", time: "08:00:00" },
  ],
  newConcursoLeads: [],
  newConcursoLeadsCount: 0,
};

function fakeDeps(overrides: Partial<AssistantDeps> = {}) {
  const sent: { to: string; body: string }[] = [];
  const seen = new Set<string>();
  const deps: AssistantDeps = {
    markProcessed: vi.fn(async (id: string) => (seen.has(id) ? false : (seen.add(id), true))),
    findUserByWaId: vi.fn(async (waId: string) => (waId === ANA ? { userId: "u1", name: "Ana Lima" } : null)),
    linkByCode: vi.fn(async (hash: string) => (hash === hashLinkCode("RDC-ABC234") ? { userId: "u1", name: "Ana Lima" } : null)),
    unlink: vi.fn(async () => {}),
    loadSnapshot: vi.fn(async () => snapshot),
    loadPendingSuggestions: vi.fn(async () => [{ kind: "entrevista_rh" as const, company: "Trilha Mobilidade", subject: null }]),
    createSuggestion: vi.fn(async () => {}),
    loadOpenLeads: vi.fn(async () => ({
      total: 2,
      leads: [
        { company: "Vertem", title: "Estágio em Dados", url: "https://vertem.gupy.io/job/1", score: 92 },
        { company: "SiDi", title: "Estágio em Engenharia de Dados", url: "https://sidi.gupy.io/job/2", score: 87 },
      ],
    })),
    loadOpenConcursoLeads: vi.fn(async () => ({
      total: 1,
      leads: [{ organ: "Tribunal de Contas do Planalto", role: "Analista de Controle Externo", url: "https://example.com/inscricao", score: 81 }],
    })),
    send: vi.fn(async (to: string, body: string) => {
      sent.push({ to, body });
    }),
    ...overrides,
  };
  return { deps, sent };
}

let counter = 0;
const message = (text: string, from = ANA) => ({ id: `wamid.${++counter}`, from, text });

describe("comandos do assistente", () => {
  it("entende comandos curtos, com ou sem cumprimento", () => {
    expect(detectCommand("Oi")).toBe("menu");
    expect(detectCommand("menu")).toBe("menu");
    expect(detectCommand("Oi, resumo!")).toBe("resumo");
    expect(detectCommand("manda o relatório")).toBe("resumo");
    expect(detectCommand("Meus prazos?")).toBe("prazos");
    expect(detectCommand("andamento")).toBe("andamento");
    expect(detectCommand("sugestões")).toBe("sugestoes");
    expect(detectCommand("desvincular")).toBe("desvincular");
    expect(detectCommand("vagas")).toBe("vagas");
    expect(detectCommand("Oi, vagas novas?")).toBe("vagas");
    expect(detectCommand("minhas vagas")).toBe("andamento");
    expect(detectCommand("concursos")).toBe("concursos");
    expect(detectCommand("Oi, meus concursos?")).toBe("concursos");
    expect(detectCommand("editais abertos")).toBe("concursos");
  });

  it("perguntas livres não viram comando", () => {
    expect(detectCommand("oi, como está a Nuvem Pay?")).toBeNull();
    expect(detectCommand("quais vagas da Nuvem Pay?")).toBeNull();
  });

  it("acha a empresa citada", () => {
    expect(findCompanyInText("oi, como está a nuvem pay?", snapshot)?.id).toBe("a1");
    expect(findCompanyInText("e o BANCO AURORA??", snapshot)?.id).toBe("a2");
    expect(findCompanyInText("e a Pixel Studio?", snapshot)).toBeNull();
  });
});

describe("código de vinculação", () => {
  it("gera, reconhece e protege o número", () => {
    const code = generateLinkCode();
    expect(code).toMatch(/^RDC-[A-HJ-NP-Z2-9]{6}$/);
    expect(extractLinkCode(`Vincular ${code.toLowerCase()}`)).toBe(code);
    expect(extractLinkCode("vincular qualquer coisa")).toBeNull();
    expect(hashLinkCode("rdc-abc234")).toBe(hashLinkCode("RDC-ABC234"));
    expect(maskPhone("5511987654321")).toBe("+55 11 9****-4321");
  });
});

describe("conversa com o assistente", () => {
  beforeEach(() => {
    counter = 0;
  });

  it("número não vinculado recebe o caminho para conectar", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("resumo", "5521888887777"), ctx);
    expect(sent[0]).toMatchObject({ to: "5521888887777" });
    expect(sent[0].body).toContain("https://rastreador.app/conexoes");
    expect(deps.loadSnapshot).not.toHaveBeenCalled();
  });

  it("vincula com código válido e recusa código inválido", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("vincular RDC-ABC234", "5521888887777"), ctx);
    expect(deps.linkByCode).toHaveBeenCalledWith(hashLinkCode("RDC-ABC234"), "5521888887777");
    expect(sent[0].body).toContain("Pronto! Este WhatsApp está conectado");

    await handleIncomingMessage(deps, message("vincular RDC-ZZZZZZ", "5521888887777"), ctx);
    expect(sent[1].body).toContain("inválido ou expirou");
  });

  it("responde resumo, prazos, andamento e sugestões", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("resumo"), ctx);
    await handleIncomingMessage(deps, message("prazos"), ctx);
    await handleIncomingMessage(deps, message("andamento"), ctx);
    await handleIncomingMessage(deps, message("sugestões"), ctx);

    expect(sent[0].body.startsWith("*Resumo de 20 out.:")).toBe(true);
    expect(sent[1].body).toContain("• Preparar perguntas · Nuvem Pay: amanhã, 21/10/2026");
    expect(sent[2].body).toContain("*Entrevista técnica* (1)\n• Banco Aurora");
    expect(sent[2].body).not.toContain("Rota");
    expect(sent[3].body).toContain("Entrevista com RH: Trilha Mobilidade");
  });

  it("lista as vagas novas do caça-vagas", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("vagas"), ctx);
    expect(sent[0].body).toContain("*2 vagas novas para você*");
    expect(sent[0].body).toContain("• 92% · Estágio em Dados · Vertem\n  https://vertem.gupy.io/job/1");
    expect(sent[0].body).toContain("https://rastreador.app/vagas");

    const empty = fakeDeps({ loadOpenLeads: vi.fn(async () => ({ total: 0, leads: [] })) });
    await handleIncomingMessage(empty.deps, message("vagas"), ctx);
    expect(empty.sent[0].body).toContain("Nenhuma vaga nova por enquanto");
  });

  it("concursos: alertas da semana, próximas datas e concursos novos; prazos também traz os concursos", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("concursos"), ctx);
    expect(sent[0].body).toContain(
      "*Atenção nos próximos 7 dias*\n• Fim das inscrições · Agência Nacional de Dados · Analista de TI: em 3 dias, 23/10/2026",
    );
    expect(sent[0].body).toContain("*Próximas datas*\n• Prova · Agência Nacional de Dados · Analista de TI: em 26 dias, 15/11/2026 às 08:00");
    expect(sent[0].body).toContain("*1 concurso novo para você*\n• Nota 81 · Analista de Controle Externo · Tribunal de Contas do Planalto");
    expect(sent[0].body).toContain("A inscrição e o pagamento são sempre no site oficial da banca.");

    await handleIncomingMessage(deps, message("prazos"), ctx);
    expect(sent[1].body).toContain("*Concursos nesta semana*\n• Fim das inscrições · Agência Nacional de Dados");

    const empty = fakeDeps({
      loadSnapshot: vi.fn(async () => ({ ...snapshot, concursos: [], concursoDates: [] })),
      loadOpenConcursoLeads: vi.fn(async () => ({ total: 0, leads: [] })),
    });
    await handleIncomingMessage(empty.deps, message("concursos"), ctx);
    expect(empty.sent[0].body).toContain("Você ainda não acompanha nenhum concurso");
  });

  it("responde sobre uma empresa", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("Oi, como está a Nuvem Pay?"), ctx);
    expect(sent[0].body).toContain("*Nuvem Pay* · Estágio em Dados");
    expect(sent[0].body).toContain("Etapa: Entrevista RH (há 2 dias)");
    expect(sent[0].body).toContain("https://rastreador.app/candidaturas/a1");
  });

  it("mensagem de recrutador encaminhada vira sugestão", async () => {
    const { deps, sent } = fakeDeps();
    const forwarded =
      "Oi Ana! Aqui é a Júlia, do RH da Trilha Mobilidade. Queremos marcar uma entrevista com o gestor no dia 23/10 às 15h.";
    await handleIncomingMessage(deps, message(forwarded), ctx);
    expect(deps.createSuggestion).toHaveBeenCalledWith("u1", expect.objectContaining({ kind: "entrevista_tecnica", company: "Trilha Mobilidade" }), forwarded);
    expect(sent[0].body).toContain("Anotei uma sugestão: Trilha Mobilidade → Entrevista técnica (prazo 23/10/2026)");
  });

  it("ignora a mesma mensagem reenviada pela Meta", async () => {
    const { deps, sent } = fakeDeps();
    const repeated = message("resumo");
    await handleIncomingMessage(deps, repeated, ctx);
    expect(await handleIncomingMessage(deps, repeated, ctx)).toBeNull();
    expect(sent).toHaveLength(1);
  });

  it("desvincula e responde ao que não entende com o menu", async () => {
    const { deps, sent } = fakeDeps();
    await handleIncomingMessage(deps, message("asdf qwer"), ctx);
    expect(sent[0].body).toContain("Não entendi");
    expect(sent[0].body).toContain("*resumo*");
    await handleIncomingMessage(deps, message("desvincular"), ctx);
    expect(deps.unlink).toHaveBeenCalledWith("u1");
  });
});

describe("webhook da Meta", () => {
  it("confere a assinatura X-Hub-Signature-256", () => {
    const body = JSON.stringify({ hello: "mundo" });
    const signature = `sha256=${createHmac("sha256", "segredo").update(body).digest("hex")}`;
    expect(isValidSignature(body, signature, "segredo")).toBe(true);
    expect(isValidSignature(body, signature, "outro-segredo")).toBe(false);
    expect(isValidSignature(body, null, "segredo")).toBe(false);
    expect(isValidSignature(`${body} `, signature, "segredo")).toBe(false);
  });

  it("extrai só as mensagens de texto", () => {
    const { texts, others } = extractTextMessages({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "m1", from: ANA, type: "text", text: { body: "resumo" } },
                  { id: "m2", from: ANA, type: "image" },
                ],
                statuses: [{ id: "s1", status: "delivered" }],
              },
            },
          ],
        },
      ],
    });
    expect(texts).toEqual([{ id: "m1", from: ANA, text: "resumo" }]);
    expect(others).toEqual([{ id: "m2", from: ANA }]);
    expect(extractTextMessages({ object: "page" }).texts).toEqual([]);
  });
});

describe("rota do webhook", () => {
  it("verifica o cadastro, recusa assinatura errada e responde às mensagens", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "verificar-123";
    process.env.WHATSAPP_APP_SECRET = "segredo-do-app";
    process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER = "5511900000000";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_teste";
    delete process.env.WHATSAPP_TOKEN;

    const { deps } = fakeDeps();
    vi.doMock("@/features/whatsapp/deps", () => ({ createAssistantDeps: () => deps }));
    const { GET, POST } = await import("@/app/api/whatsapp/webhook/route");
    const { NextRequest } = await import("next/server");

    const verify = await GET(
      new NextRequest("http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verificar-123&hub.challenge=42"),
    );
    expect(await verify.text()).toBe("42");
    const wrong = await GET(new NextRequest("http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=42"));
    expect(wrong.status).toBe(403);

    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.rota", from: ANA, type: "text", text: { body: "prazos" } }] } }] }],
    });
    const sign = (secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const post = (signature: string) =>
      POST(new NextRequest("http://localhost/api/whatsapp/webhook", { method: "POST", body, headers: { "x-hub-signature-256": signature } }));

    expect((await post(sign("segredo-falso"))).status).toBe(401);
    const ok = await post(sign("segredo-do-app"));
    expect(ok.status).toBe(200);
    const json = await ok.json();
    // Sem WHATSAPP_TOKEN: modo de teste, devolve as respostas em vez de enviar pela Meta.
    expect(json.respostas[0]).toMatchObject({ to: ANA });
    expect(json.respostas[0].text).toContain("Preparar perguntas");
  });
});

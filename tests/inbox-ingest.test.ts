import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildIngestRows } from "@/features/inbox/ingest";
import { buildSampleData } from "@/features/demo/sample-data";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
const { POST } = await import("@/app/api/inbox/email/route");

const confirmation = {
  id: "msg-1",
  from: "Nuvem Pay <noreply@gupy.io>",
  subject: "Recebemos sua candidatura para a vaga de Estágio em Dados",
  date: "2026-10-20T13:00:00.000Z",
  body: "Olá! Recebemos sua candidatura para a vaga de Estágio em Dados na Nuvem Pay.",
};
const jobAlert = {
  id: "msg-2",
  from: "LinkedIn Vagas <jobalerts-noreply@linkedin.com>",
  subject: "15 novas vagas de Estágio em Dados",
  date: "2026-10-20T13:00:00.000Z",
  body: "Confira as vagas que combinam com você.",
};

function request(body: unknown, token?: string) {
  return new NextRequest("http://localhost/api/inbox/email", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("interpretação dos e-mails recebidos", () => {
  it("guarda só o que é sobre processo seletivo, já interpretado", () => {
    const rows = buildIngestRows({ emails: [confirmation, jobAlert] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      external_id: "msg-1",
      kind: "confirmacao",
      suggested_stage: "enviada",
      confidence: "alta",
      company: "Nuvem Pay",
      role_title: "Estágio em Dados",
      platform: "gupy",
      received_at: "2026-10-20T13:00:00.000Z",
    });
  });
});

describe("POST /api/inbox/email", () => {
  beforeEach(() => rpc.mockReset());

  it("exige o token", async () => {
    const response = await POST(request({ emails: [] }));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa formato inválido", async () => {
    expect((await POST(request("não é json", "rdc_token-de-teste-123456"))).status).toBe(400);
    expect((await POST(request({ mensagens: [] }, "rdc_token-de-teste-123456"))).status).toBe(400);
  });

  it("envia ao banco só as mensagens relevantes, com o token", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    const response = await POST(request({ emails: [confirmation, jobAlert] }, "rdc_token-de-teste-123456"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recebidos: 2, relevantes: 1, gravados: 1 });
    expect(rpc).toHaveBeenCalledWith("inbox_ingest", {
      p_token: "rdc_token-de-teste-123456",
      p_items: [expect.objectContaining({ external_id: "msg-1", kind: "confirmacao" })],
    });
  });

  it("não chama o banco quando nada é relevante", async () => {
    const response = await POST(request({ emails: [jobAlert] }, "rdc_token-de-teste-123456"));
    expect(await response.json()).toEqual({ recebidos: 1, relevantes: 0, gravados: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("responde 401 quando o banco recusa o token", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "28000", message: "Token inválido." } });
    const response = await POST(request({ emails: [confirmation] }, "rdc_token-errado-000000000"));
    expect(response.status).toBe(401);
  });
});

describe("caixa de entrada de exemplo", () => {
  it("liga os itens resolvidos às candidaturas e gera ids únicos a cada carga", () => {
    let counter = 0;
    const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
    const first = buildSampleData("user-1", "2026-10-20", newId);
    const second = buildSampleData("user-1", "2026-10-20", newId);

    const resolved = first.inbox.filter((item) => item.status === "aplicada");
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.every((item) => first.applications.some((a) => a.id === item.application_id))).toBe(true);
    expect(first.inbox.some((item) => item.confidence === "alta" && item.status !== "aplicada")).toBe(true);

    const ids = [...first.inbox, ...second.inbox].map((item) => item.external_id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

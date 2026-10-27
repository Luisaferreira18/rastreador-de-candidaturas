import { describe, expect, it, vi } from "vitest";
import { buildDailyReport, type ReportSnapshot } from "@/features/report/build";
import { escapeHtml, renderReportEmail, renderReportText } from "@/features/report/render";

const TODAY = "2026-10-20";

const snapshot: ReportSnapshot = {
  applications: [
    { id: "a1", company: "Nuvem Pay", role_title: "Estágio em Dados", stage: "entrevista_rh", platform: "gupy", stage_changed_at: "2026-10-19T13:00:00Z", applied_at: "2026-10-15", created_at: "2026-10-15T13:00:00Z" },
    { id: "a2", company: "Sol Nascente", role_title: "Estágio em TI", stage: "enviada", platform: "site_empresa", stage_changed_at: "2026-09-20T13:00:00Z", applied_at: "2026-09-20", created_at: "2026-09-20T13:00:00Z" },
    { id: "a3", company: "Orion <Seguros>", role_title: "Estágio", stage: "enviada", platform: "linkedin", stage_changed_at: "2026-10-20T12:00:00Z", applied_at: "2026-10-20", created_at: "2026-10-20T12:00:00Z" },
    { id: "a4", company: "Rota", role_title: "TI", stage: "reprovada", platform: "gupy", stage_changed_at: "2026-08-01T13:00:00Z", applied_at: "2026-07-20", created_at: "2026-07-20T13:00:00Z" },
  ],
  history: [
    { application_id: "a1", from_stage: null, to_stage: "enviada", changed_at: "2026-10-15T13:00:00Z" },
    { application_id: "a1", from_stage: "enviada", to_stage: "entrevista_rh", changed_at: "2026-10-19T13:00:00Z" },
    { application_id: "a2", from_stage: null, to_stage: "enviada", changed_at: "2026-09-20T13:00:00Z" },
    { application_id: "a3", from_stage: null, to_stage: "enviada", changed_at: "2026-10-20T12:00:00Z" },
    { application_id: "a4", from_stage: null, to_stage: "enviada", changed_at: "2026-07-20T13:00:00Z" },
    { application_id: "a4", from_stage: "enviada", to_stage: "reprovada", changed_at: "2026-08-01T13:00:00Z" },
  ],
  tasks: [
    { application_id: "a1", title: "Entrevista com o RH", due_date: "2026-10-20" },
    { application_id: "a2", title: "Mandar follow-up", due_date: "2026-10-18" },
    { application_id: "a1", title: "Estudar a empresa", due_date: "2026-10-24" },
    { application_id: "a1", title: "Sem data", due_date: null },
  ],
  pendingSuggestions: 2,
  newLeads: [],
  newLeadsCount: 0,
};

describe("relatório diário", () => {
  const report = buildDailyReport(snapshot, TODAY);

  it("separa prazos atrasados, de hoje e da semana", () => {
    expect(report.overdue).toEqual([{ title: "Mandar follow-up", company: "Sol Nascente", dueDate: "2026-10-18" }]);
    expect(report.dueToday.map((task) => task.title)).toEqual(["Entrevista com o RH"]);
    expect(report.dueSoon.map((task) => task.title)).toEqual(["Estudar a empresa"]);
  });

  it("lista o que mudou desde ontem, do mais recente para o mais antigo", () => {
    expect(report.changes.map((change) => [change.company, change.from, change.to])).toEqual([
      ["Orion <Seguros>", null, "enviada"],
      ["Nuvem Pay", "enviada", "entrevista_rh"],
    ]);
  });

  it("aponta vagas em andamento paradas há 14 dias ou mais", () => {
    expect(report.stale).toEqual([{ company: "Sol Nascente", stage: "enviada", days: 30 }]);
  });

  it("resume números e manchete", () => {
    expect(report.numbers).toMatchObject({ total: 4, active: 3, sentThisWeek: 2 });
    expect(report.headline).toBe("1 prazo hoje, 1 atrasado, 2 novidades, 2 sugestões para conferir");
    expect(report.isEmpty).toBe(false);
  });

  it("dia sem nada: manchete tranquila", () => {
    const empty = buildDailyReport(
      { applications: [], history: [], tasks: [], pendingSuggestions: 0, newLeads: [], newLeadsCount: 0 },
      TODAY,
    );
    expect(empty).toMatchObject({ headline: "nada urgente hoje", isEmpty: true });
  });

  it("o e-mail escapa o texto do usuário e traz o link do painel", () => {
    const email = renderReportEmail(report, "https://rastreador.app");
    expect(email.subject).toBe("Resumo de 20 out.: 1 prazo hoje, 1 atrasado, 2 novidades, 2 sugestões para conferir");
    expect(email.html).toContain("Orion &lt;Seguros&gt;");
    expect(email.html).not.toContain("Orion <Seguros>");
    expect(email.html).toContain('href="https://rastreador.app/painel"');
    expect(email.text).toContain("Atrasados");
  });

  it("texto para WhatsApp usa *negrito* nos títulos", () => {
    const text = renderReportText(report, "https://rastreador.app", { bold: true });
    expect(text.split("\n")[0]).toBe("*Resumo de 20 out.: 1 prazo hoje, 1 atrasado, 2 novidades, 2 sugestões para conferir*");
    expect(text).toContain("*Hoje*\n• Entrevista com o RH · Nuvem Pay: hoje, 20/10/2026");
  });

  it("traz as vagas novas do caça-vagas, com link e nota", () => {
    const withLeads = buildDailyReport(
      {
        ...snapshot,
        newLeads: [{ company: "Vertem", title: "Estágio em <Dados>", url: "https://vertem.gupy.io/job/1", score: 92 }],
        newLeadsCount: 3,
      },
      TODAY,
    );
    expect(withLeads.headline).toBe("1 prazo hoje, 1 atrasado, 2 novidades, 2 sugestões para conferir, 3 vagas novas para você");
    const email = renderReportEmail(withLeads, "https://rastreador.app");
    expect(email.html).toContain('href="https://vertem.gupy.io/job/1"');
    expect(email.html).toContain("Estágio em &lt;Dados&gt;");
    expect(email.html).toContain("E mais 2.");
    const text = renderReportText(withLeads, "https://rastreador.app", { bold: true });
    expect(text).toContain("*Vagas novas para você*\n• 92% · Estágio em <Dados> · Vertem\n  https://vertem.gupy.io/job/1");
    expect(text).toContain("Ver todas: https://rastreador.app/vagas");
  });

  it("escapeHtml cobre os caracteres perigosos", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;");
  });
});

describe("POST /api/report", () => {
  it("usa o token do script, recusa token inválido e devolve o e-mail pronto", async () => {
    const rpc = vi.fn();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
    const { POST } = await import("@/app/api/report/route");
    const { NextRequest } = await import("next/server");
    const call = (token?: string) =>
      POST(
        new NextRequest("http://localhost/api/report", {
          method: "POST",
          headers: token ? { authorization: `Bearer ${token}` } : {},
        }),
      );

    expect((await call()).status).toBe(401);

    rpc.mockResolvedValueOnce({ data: null, error: { code: "28000", message: "Token inválido." } });
    expect((await call("rdc_token-errado-0000000000")).status).toBe(401);

    rpc.mockResolvedValueOnce({
      data: {
        applications: snapshot.applications,
        history: snapshot.history,
        tasks: snapshot.tasks,
        pending_suggestions: 2,
        new_leads: [{ company: "Vertem", title: "Estágio em Dados", url: "https://vertem.gupy.io/job/1", score: 92 }],
        new_leads_count: 1,
      },
      error: null,
    });
    const response = await call("rdc_token-certo-00000000000");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assunto).toMatch(/^Resumo de /);
    expect(body.html).toContain("<!doctype html>");
    expect(body.assunto).toContain("1 vaga nova para você");
    expect(rpc).toHaveBeenLastCalledWith("report_snapshot", { p_token: "rdc_token-certo-00000000000" });
  });
});

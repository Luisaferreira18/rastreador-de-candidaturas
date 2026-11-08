import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NO_DESCRIPTION_WARNING,
  isLinkedinAlert,
  parseLinkedinAlert,
  selectAlertLeads,
  type JobAlertContext,
} from "@/features/job-search/email-alerts";
import { buildIngestRows } from "@/features/inbox/ingest";
import { leadToApplication, type JobLead } from "@/features/job-search/lead";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
const { POST } = await import("@/app/api/inbox/email/route");

const TODAY = "2026-11-06";
const TRACKING = "?trackingId=abc%3D%3D&refId=xyz&midToken=AQ123";

/**
 * Textos fictícios, no formato que se espera desses e-mails. Falta conferir com
 * um alerta de verdade: a leitura se apoia no link para resistir a variações.
 */
const ALERT_PT = [
  "Seu alerta de vaga para analista de dados em Brasil",
  "12 novas vagas correspondem às suas preferências.",
  "",
  "Analista de Dados Júnior",
  "Nuvem Pay",
  "São Paulo, São Paulo, Brasil",
  "Candidatura simplificada",
  `Ver vaga: https://www.linkedin.com/comm/jobs/view/4012345678/${TRACKING}`,
  "",
  "---------------------------------------------------------",
  "",
  "Estágio em Dados",
  "Banco Exemplo",
  "Belo Horizonte, Minas Gerais, Brasil (Híbrido)",
  "Recrutando ativamente",
  "3 conexões trabalham aqui",
  `Ver vaga: https://www.linkedin.com/comm/jobs/view/4012345679/${TRACKING}`,
  "",
  "---------------------------------------------------------",
  "Ver todas as vagas: https://www.linkedin.com/comm/jobs/search/?keywords=dados",
].join("\n");

const ALERT_EN = [
  "Your job alert for data analyst",
  "30 new jobs match your preferences.",
  "Data Analyst",
  "Example Corp",
  "Remote",
  `View job: https://www.linkedin.com/comm/jobs/view/4012345680/${TRACKING}`,
].join("\n");

describe("quem é um alerta", () => {
  it("reconhece pelo remetente", () => {
    expect(isLinkedinAlert("LinkedIn Vagas <jobalerts-noreply@linkedin.com>")).toBe(true);
    expect(isLinkedinAlert("LinkedIn <jobs-listings@linkedin.com>")).toBe(true);
    expect(isLinkedinAlert("LinkedIn <jobs-noreply@linkedin.com>")).toBe(false);
    expect(isLinkedinAlert("Golpe <jobalerts@linkedin.com.exemplo.net>")).toBe(false);
    expect(isLinkedinAlert(null)).toBe(false);
  });
});

describe("leitura do alerta", () => {
  it("lê cargo, empresa, local e tipo, em português", () => {
    const [first, second] = parseLinkedinAlert(ALERT_PT);
    expect(first).toMatchObject({
      source: "linkedin",
      externalId: "4012345678",
      title: "Analista de Dados Júnior",
      company: "Nuvem Pay",
      location: "São Paulo, São Paulo, Brasil",
      jobType: null,
      text: "",
    });
    expect(second).toMatchObject({
      externalId: "4012345679",
      title: "Estágio em Dados",
      company: "Banco Exemplo",
      jobType: "estagio",
      workModel: "hibrido",
    });
  });

  it("lê também em inglês", () => {
    expect(parseLinkedinAlert(ALERT_EN)).toEqual([
      expect.objectContaining({ title: "Data Analyst", company: "Example Corp", location: "Remote", workModel: "remoto" }),
    ]);
  });

  it("guarda o link sem os parâmetros de rastreamento", () => {
    expect(parseLinkedinAlert(ALERT_EN)[0].url).toBe("https://www.linkedin.com/jobs/view/4012345680/");
  });

  it("aceita link com o nome da vaga e empresa e local na mesma linha", () => {
    const text = `Analista de Dados\nStone · São Paulo, Brasil\nhttps://br.linkedin.com/jobs/view/analista-de-dados-na-stone-4012345681 `;
    expect(parseLinkedinAlert(text)).toEqual([
      expect.objectContaining({ externalId: "4012345681", title: "Analista de Dados", company: "Stone", location: "São Paulo, Brasil" }),
    ]);
  });

  it("a mesma vaga duas vezes conta uma", () => {
    const link = `https://www.linkedin.com/comm/jobs/view/4012345682/${TRACKING}`;
    expect(parseLinkedinAlert(`Analista\nStone\nSão Paulo\n${link}\nVer vaga: ${link}\n`)).toHaveLength(1);
  });

  it("não inventa vaga: sem dados, com link cortado ou sem link", () => {
    expect(parseLinkedinAlert(`Ver vaga: https://www.linkedin.com/comm/jobs/view/4012345683/ fim`)).toEqual([]);
    expect(parseLinkedinAlert("Analista\nStone\nSão Paulo\nhttps://www.linkedin.com/comm/jobs/view/40123")).toEqual([]);
    expect(parseLinkedinAlert("Confira as vagas que combinam com você.")).toEqual([]);
    expect(parseLinkedinAlert("Analista\nStone\nSão Paulo\nhttps://www.linkedin.com/comm/jobs/search/?id=4012345684 ")).toEqual([]);
    // No limite de 8 mil caracteres do script, o número da vaga pode vir pela metade.
    const cut = "Analista\nStone\nSão Paulo\nhttps://www.linkedin.com/comm/jobs/view/4012345685";
    expect(parseLinkedinAlert("x".repeat(8000 - cut.length) + "\n" + cut)).toEqual([]);
    expect(parseLinkedinAlert(cut)).toHaveLength(1);
  });
});

const context: JobAlertContext = {
  profile: {
    roles: ["Analista de Dados", "Estágio em Dados"],
    keywords: [],
    excluded_words: [],
    city: null,
    state: "SP",
    work_models: ["presencial", "hibrido", "remoto"],
    job_types: ["clt", "estagio"],
    min_salary_cents: null,
    auto_search: true,
  },
  resume: null,
  applications: [],
  leads: [],
};

describe("quais vagas viram sugestão", () => {
  const jobs = [...parseLinkedinAlert(ALERT_PT), ...parseLinkedinAlert(ALERT_EN)];

  it("usa as regras da busca: fica de fora quem está em outro estado", () => {
    const leads = selectAlertLeads(jobs, context, TODAY);
    expect(leads.map((lead) => lead.external_id).sort()).toEqual(["4012345678", "4012345680"]);
  });

  it("toda vaga avisa que os requisitos não foram conferidos", () => {
    for (const lead of selectAlertLeads(jobs, context, TODAY)) {
      expect(lead.warnings[0]).toBe(NO_DESCRIPTION_WARNING);
    }
  });

  it("sem dizer que é estágio, não entra em quem só procura estágio", () => {
    const leads = selectAlertLeads(jobs, { ...context, profile: { ...context.profile, state: null, job_types: ["estagio"] } }, TODAY);
    expect(leads.map((lead) => lead.title)).toEqual(["Estágio em Dados"]);
  });

  it("não repete vaga já sugerida, nem a mesma vaga vinda de outra fonte, nem o que já está no quadro", () => {
    const seen: JobAlertContext = {
      ...context,
      leads: [
        { source: "linkedin", external_id: "4012345678", company: "Nuvem Pay", title: "Analista de Dados Júnior", url: "https://www.linkedin.com/jobs/view/4012345678/" },
      ],
      applications: [{ company: "Example Corp", role_title: "Data Analyst", job_url: null }],
    };
    expect(selectAlertLeads(jobs, seen, TODAY)).toEqual([]);

    const otherSource: JobAlertContext = {
      ...context,
      leads: [{ source: "gupy", external_id: "9", company: "Nuvem Pay", title: "Analista de Dados Júnior", url: "https://nuvem.gupy.io/job/9" }],
    };
    expect(selectAlertLeads(jobs, otherSource, TODAY).map((lead) => lead.external_id)).toEqual(["4012345680"]);
  });

  it("com a busca automática desligada, nada entra", () => {
    expect(selectAlertLeads(jobs, { ...context, profile: { ...context.profile, auto_search: false } }, TODAY)).toEqual([]);
  });
});

describe("candidatura criada a partir da vaga", () => {
  it("marca a plataforma LinkedIn", () => {
    const lead = { source: "linkedin", company: "Stone", title: "Analista", url: "https://www.linkedin.com/jobs/view/1/", reasons: [], benefits: [], score: 70 } as unknown as JobLead;
    expect(leadToApplication(lead, ["clt"]).platform).toBe("linkedin");
  });
});

describe("POST /api/inbox/email com alertas", () => {
  const alert = {
    id: "msg-alerta",
    from: "LinkedIn Vagas <jobalerts-noreply@linkedin.com>",
    subject: "Analista de Dados: Nuvem Pay e mais",
    date: "2026-11-06T10:00:00.000Z",
    body: ALERT_PT,
  };
  const confirmation = {
    id: "msg-1",
    from: "Nuvem Pay <noreply@gupy.io>",
    subject: "Recebemos sua candidatura para a vaga de Estágio em Dados",
    date: "2026-11-06T10:00:00.000Z",
    body: "Olá! Recebemos sua candidatura para a vaga de Estágio em Dados na Nuvem Pay.",
  };
  const request = (emails: unknown[]) =>
    new NextRequest("http://localhost/api/inbox/email", {
      method: "POST",
      headers: { authorization: "Bearer token-pessoal-com-tamanho-suficiente" },
      body: JSON.stringify({ emails }),
    });
  const answer = (handlers: Record<string, { data: unknown; error: unknown }>) =>
    rpc.mockImplementation(async (name: string) => handlers[name] ?? { data: null, error: null });

  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("grava as vagas do alerta, e o alerta não vira sugestão da caixa de entrada", async () => {
    answer({ job_alert_context: { data: context, error: null }, job_alert_ingest: { data: 1, error: null } });
    const response = await POST(request([alert]));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recebidos: 1, relevantes: 0, gravados: 0, vagas: 1 });
    expect(rpc).not.toHaveBeenCalledWith("inbox_ingest", expect.anything());
    expect(rpc).toHaveBeenCalledWith("job_alert_ingest", {
      p_token: "token-pessoal-com-tamanho-suficiente",
      p_leads: [expect.objectContaining({ external_id: "4012345678", url: "https://www.linkedin.com/jobs/view/4012345678/" })],
    });
    expect(buildIngestRows({ emails: [alert] })).toEqual([]);
  });

  it("sem as funções novas no banco, as sugestões normais continuam", async () => {
    answer({
      inbox_ingest: { data: 1, error: null },
      job_alert_context: { data: null, error: { code: "PGRST202", message: "função não encontrada" } },
    });
    const response = await POST(request([confirmation, alert]));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recebidos: 2, relevantes: 1, gravados: 1, vagas: 0 });
  });

  it("sem perfil de busca, não grava nada", async () => {
    answer({ job_alert_context: { data: null, error: null } });
    expect(await (await POST(request([alert]))).json()).toMatchObject({ vagas: 0 });
    expect(rpc).not.toHaveBeenCalledWith("job_alert_ingest", expect.anything());
  });

  it("token inválido responde 401", async () => {
    answer({ job_alert_context: { data: null, error: { code: "28000" } } });
    expect((await POST(request([alert]))).status).toBe(401);
  });

  it("e-mail comum não consulta as funções de alerta", async () => {
    answer({ inbox_ingest: { data: 1, error: null } });
    expect(await (await POST(request([confirmation]))).json()).toEqual({ recebidos: 1, relevantes: 1, gravados: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

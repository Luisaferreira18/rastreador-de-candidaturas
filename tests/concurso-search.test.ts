import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  articleToNotice,
  fetchDouNotices,
  inlabsZipUrl,
  isOpeningNotice,
  openDataZipLink,
  parseDouXml,
  unzipArticles,
} from "@/features/concursos/search/dou";
import { SourceError, type Fetcher } from "@/features/concursos/search/http";
import { leadToConcurso } from "@/features/concursos/search/lead";
import { normalizePlace, toConcursoProfilePayload, emptyConcursoProfileFormValues } from "@/features/concursos/search/profile";
import {
  coverageOf,
  fetchQueridoDiario,
  gazetteToNotices,
  matchCity,
  openConcursoId,
  parseGazettes,
} from "@/features/concursos/search/querido-diario";
import { noticeToRow } from "@/features/concursos/search/rows";
import { refreshCatalog, scoreForUser } from "@/features/concursos/search/run";
import { scoreNotice } from "@/features/concursos/search/score";
import type { CatalogNotice, ConcursoSearchProfile } from "@/features/concursos/search/types";
import { formatCurrencyCompact } from "@/lib/format";
import { createFakeSupabase } from "./support/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const { getCurrentUser } = await import("@/features/auth/session");
const { createClient } = await import("@/lib/supabase/server");
const { dismissConcursoLead, followConcursoLead } = await import("@/features/concursos/search/actions");

const TODAY = "2026-10-29";
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "eu@email.com", name: null, avatarUrl: null, isDemo: false };

/** XML reais do Diário Oficial da União, Seção 3, outubro de 2026. */
const xml = (name: string) => readFileSync(`tests/fixtures/dou/${name}.xml`, "utf8");
/** Resposta real da API do Querido Diário (outubro de 2026), com nomes e CPFs mascarados. */
const qdFixture = JSON.parse(readFileSync("tests/fixtures/querido-diario/gazettes-outubro-2026.json", "utf8"));

const cgu = () => articleToNotice(parseDouXml(xml("edital-abertura-cgu"))!, TODAY);

function fakeFetcher(overrides: Partial<Fetcher> = {}): Fetcher & { calls: { kind: string; url: string; init?: unknown }[] } {
  const calls: { kind: string; url: string; init?: unknown }[] = [];
  const fail = (kind: string) => async (url: string) => {
    calls.push({ kind, url });
    throw new SourceError("não respondeu a tempo");
  };
  const wrap = <T extends (...args: never[]) => Promise<unknown>>(kind: string, fn: T | undefined): T =>
    (async (url: string, init?: unknown) => {
      calls.push({ kind, url, init });
      if (!fn) return fail(kind)(url);
      return (fn as unknown as (url: string, init?: unknown) => Promise<unknown>)(url, init);
    }) as unknown as T;
  return {
    calls,
    json: wrap("json", overrides.json),
    text: wrap("text", overrides.text),
    bytes: wrap("bytes", overrides.bytes),
    login: wrap("login", overrides.login),
  };
}

describe("Diário Oficial da União", () => {
  it("lê o XML da matéria e reconhece só o edital de abertura", () => {
    const opening = parseDouXml(xml("edital-abertura-cgu"))!;
    expect(opening).toMatchObject({ id: "24474987", type: "Edital de Concurso Público", publishedAt: "2026-10-09" });
    expect(isOpeningNotice(opening)).toBe(true);
    expect(isOpeningNotice(parseDouXml(xml("extrato-contrato-cgu"))!)).toBe(false);
    // Complementação de edital (reaplicação de prova) não é abertura.
    expect(isOpeningNotice(parseDouXml(xml("edital-complementar-ifsuldeminas"))!)).toBe(false);
  });

  it("transforma o edital em item do catálogo", () => {
    const notice = cgu();
    expect(notice).toMatchObject({
      source: "dou",
      externalId: "24474987",
      organ: "Controladoria-Geral da União",
      examBoard: "Cebraspe",
      sphere: "federal",
      salaryCents: 2_000_000,
      reserveList: true,
      publishedAt: "2026-10-09",
      noticeUrl: "https://pesquisa.in.gov.br/imprensa/jsp/visualiza/index.jsp?data=09/10/2026&jornal=530&pagina=155",
      registrationUrl: "http://www.cebraspe.org.br/concursos/cgu_26_affc",
    });
    expect(notice.roles).toHaveLength(4);
    expect(notice.roles.every((role) => role.education === "superior")).toBe(true);
  });

  it("abre o ZIP e filtra pelos dias pedidos (a data vem no nome do arquivo)", () => {
    const zip = zipSync({
      "20261009/DO3/530_20261009_24474987-1.xml": strToU8(xml("edital-abertura-cgu")),
      "20261001/DO3/530_20261001_24433322.xml": strToU8(xml("extrato-contrato-cgu")),
      "20261001/DO3/3_BCB_1_001.jpg": new Uint8Array([1, 2, 3]),
    });
    expect(unzipArticles(zip)).toHaveLength(2);
    expect(unzipArticles(zip, new Set(["2026-10-09"]))).toHaveLength(1);
    expect(() => unzipArticles(new Uint8Array([1, 2, 3]))).toThrow(SourceError);
  });

  it("com conta no INLABS, faz login e baixa o arquivo do dia com o cookie", async () => {
    const zip = zipSync({ "530_20261009_24474987-1.xml": strToU8(xml("edital-abertura-cgu")) });
    const fetcher = fakeFetcher({
      login: async () => ["inlabs_session_cookie=abc123; path=/; HttpOnly"],
      bytes: async () => zip,
    });
    const result = await fetchDouNotices(fetcher, ["2026-10-09"], TODAY, { email: "eu@email.com", password: "senha" });
    expect(result).toMatchObject({ via: "inlabs", warning: null });
    expect(result.notices.map((notice) => notice.organ)).toEqual(["Controladoria-Geral da União"]);
    const download = fetcher.calls.find((call) => call.kind === "bytes")!;
    expect(download.url).toBe(inlabsZipUrl("2026-10-09"));
    expect(download.init).toMatchObject({ headers: { Cookie: "inlabs_session_cookie=abc123", origem: "736372697074" } });
  });

  it("se o INLABS falhar (manutenção), usa o arquivo do mês dos Dados Abertos", async () => {
    const zip = zipSync({ "20261009/DO3/530_20261009_24474987-1.xml": strToU8(xml("edital-abertura-cgu")) });
    const page =
      '<a href="/documents/49035712/740172584/S01102026_Atualizado175043.zip/db00?download=true">Seção 1</a>' +
      '<a href="/documents/49035712/740172584/S03102026_Atualizado175812.zip/022d?version=1.0&amp;download=true">Seção 3</a>';
    const fetcher = fakeFetcher({ login: async () => [], text: async () => page, bytes: async () => zip });
    const result = await fetchDouNotices(fetcher, ["2026-10-09"], TODAY, { email: "eu@email.com", password: "senha" });
    expect(result.via).toBe("dados-abertos");
    expect(result.warning).toContain("INLABS");
    expect(result.notices).toHaveLength(1);
    expect(fetcher.calls.find((call) => call.kind === "bytes")!.url).toBe(
      "https://www.in.gov.br/documents/49035712/740172584/S03102026_Atualizado175812.zip/022d?version=1.0&download=true",
    );
    expect(openDataZipLink(page, 2026, 9)).toBeNull();
  });
});

describe("Querido Diário", () => {
  const gazettes = parseGazettes(qdFixture);

  it("dos diários de outubro, só os concursos abertos viram sugestão", () => {
    const notices = gazettes.flatMap((gazette) => gazetteToNotices(gazette, TODAY));
    expect(notices.map((notice) => notice.externalId).sort()).toEqual(["3531704:01/2026", "3557006:02/2026"]);
    const votorantim = notices.find((notice) => notice.city === "Votorantim")!;
    expect(votorantim).toMatchObject({
      organ: "Prefeitura Municipal de Votorantim",
      examBoard: "Avança SP",
      sphere: "municipal",
      state: "SP",
      registrationUrl: "https://www.avancasp.org.br",
      publishedAt: "2026-10-16",
    });
    expect(votorantim.noticeUrl).toMatch(/^https:\/\/data\.queridodiario\.ok\.org\.br\/3557006\/2026-10-16\//);
    expect(notices.find((notice) => notice.city === "Monteiro Lobato")?.organ).toBe("Prefeitura Municipal de Monteiro Lobato");
  });

  it("convocação, nomeação, resultado e concursos antigos não contam", () => {
    expect(openConcursoId("EDITAL DE CONVOCAÇÃO DO CONCURSO PÚBLICO 001/2026 - inscrição nº 123", 2026)).toBeNull();
    expect(openConcursoId("Inscrições abertas do Concurso Público nº 01/2024", 2026)).toBeNull();
    expect(openConcursoId("Homologa o Concurso Público nº 02/2026 e a inscrição dos aprovados", 2026)).toBeNull();
    expect(openConcursoId("Estarão abertas as inscrições do Concurso Público nº 3/2026", 2026)).toBe("03/2026");
  });

  it("diz se cada cidade está em dia, parada ou fora do Querido Diário", () => {
    const cities = [
      { territory_id: "3106200", territory_name: "Belo Horizonte", state_code: "MG", level: "3" },
      { territory_id: "3550308", territory_name: "São Paulo", state_code: "SP", level: "3" },
    ];
    expect(matchCity("sao paulo/sp", cities)?.territory_id).toBe("3550308");
    expect(matchCity("Belo Horizonte/SP", cities)).toBeNull();
    expect(coverageOf("Belo Horizonte/MG", cities[0], "2026-03-25", TODAY)).toEqual({
      place: "Belo Horizonte/MG",
      status: "parado",
      lastDate: "2026-03-25",
    });
    expect(coverageOf("São Paulo/SP", cities[1], "2026-10-27", TODAY).status).toBe("em-dia");
    expect(coverageOf("São Paulo/SP", cities[1], null, TODAY).status).toBe("sem-diarios");
    expect(coverageOf("Juiz de Fora/MG", null, null, TODAY).status).toBe("nao-encontrada");
  });

  it("busca nos diários das cidades do perfil", async () => {
    const fetcher = fakeFetcher({
      json: async (url: string) => {
        if (url.includes("/cities")) return { cities: [{ territory_id: "3557006", territory_name: "Votorantim", state_code: "SP", level: "1" }] };
        if (url.includes("size=1&")) return { gazettes: [{ territory_id: "3557006", date: "2026-10-28", excerpts: [] }] };
        return qdFixture;
      },
    });
    const result = await fetchQueridoDiario(fetcher, ["Votorantim/SP", "Juiz de Fora/MG"], "2026-09-29", TODAY);
    expect(result.coverage.map((item) => item.status)).toEqual(["em-dia", "nao-encontrada"]);
    expect(result.notices.length).toBeGreaterThan(0);
    const search = fetcher.calls.find((call) => call.url.includes("querystring"))!;
    expect(search.url).toContain("territory_ids=3557006");
    expect(search.url).toContain("published_since=2026-09-29");
  });
});

describe("nota dos concursos", () => {
  const profile: ConcursoSearchProfile = {
    education: "superior",
    areas: ["TI"],
    roles: ["Auditor"],
    spheres: ["federal", "estadual", "municipal"],
    cities: ["Belo Horizonte/MG"],
    states: [],
    minSalaryCents: 500_000,
    examBoards: ["Cebraspe"],
    acceptsRelocation: false,
  };
  const municipal = (overrides: Partial<CatalogNotice> = {}): CatalogNotice => ({
    ...cgu(),
    source: "querido_diario",
    organ: "Prefeitura Municipal de Votorantim",
    roles: [{ title: "Analista de Sistemas", education: "superior" }],
    sphere: "municipal",
    city: "Votorantim",
    state: "SP",
    examBoard: "Avança SP",
    ...overrides,
  });

  it("CGU: cargo de TI, nível superior, federal, salário acima do mínimo e banca preferida", () => {
    const match = scoreNotice(cgu(), profile, TODAY);
    expect(match).toMatchObject({
      excluded: false,
      role: "Auditor Federal de Finanças e Controle (AFFC) - Especialidade: Tecnologia da Informação - Ciência de Dados",
    });
    if (match.excluded) return;
    expect(match.score).toBeGreaterThanOrEqual(85);
    expect(match.reasons).toEqual(expect.arrayContaining(["Nível superior", "Federal", "Salário acima do mínimo", "Banca preferida: Cebraspe"]));
  });

  it("deixa de fora o que claramente não serve", () => {
    const reason = (notice: CatalogNotice, custom: Partial<ConcursoSearchProfile> = {}) => {
      const match = scoreNotice(notice, { ...profile, ...custom }, TODAY);
      return match.excluded ? match.reason : null;
    };
    expect(reason(cgu(), { education: "medio" })).toBe("Exige nível superior");
    expect(reason(cgu(), { spheres: ["municipal"] })).toBe("Concurso federal");
    expect(reason(cgu(), { areas: ["Saúde"], roles: ["Enfermeiro"] })).toBe("Cargo fora do perfil");
    expect(reason({ ...cgu(), dates: [{ kind: "inscricao_fim", date: "2026-10-20", time: null, note: null }] })).toBe(
      "Inscrições encerradas",
    );
    expect(reason(municipal())).toBe("Em outro estado");
    expect(reason(municipal(), { acceptsRelocation: true })).toBeNull();
  });

  it("avisa inscrição terminando e salário abaixo do mínimo", () => {
    const match = scoreNotice(
      { ...cgu(), salaryCents: 300_000, dates: [{ kind: "inscricao_fim", date: "2026-11-01", time: null, note: null }] },
      profile,
      TODAY,
    );
    expect(match).toMatchObject({
      excluded: false,
      warnings: [`Salário de ${formatCurrencyCompact(300_000)}: abaixo do seu mínimo`, "Inscrições terminam em 3 dias"],
    });
  });
});

describe("busca e sugestões", () => {
  const profileRow = {
    user_id: USER.id,
    education: "superior",
    areas: ["TI"],
    roles: [],
    spheres: ["federal", "estadual", "municipal"],
    cities: [],
    states: [],
    min_salary_cents: null,
    exam_boards: [],
    accepts_relocation: false,
    auto_search: true,
    last_run_at: null,
    last_run_stats: null,
    created_at: "",
    updated_at: "",
  } as const;
  const catalogRow = { ...noticeToRow(cgu()), id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", found_at: "2026-10-09T09:00:00Z" };

  it("grava a sugestão nova sem repetir as já sugeridas (nem as descartadas)", async () => {
    const fresh = createFakeSupabase({
      "concurso_notices.select": { data: [catalogRow], error: null },
      "concurso_leads.select": { data: [], error: null },
      "concurso_leads.upsert": { data: [{ id: "l1" }], error: null },
    });
    const stats = await scoreForUser(fresh.client as never, USER.id, profileRow as never, { today: TODAY });
    expect(stats).toMatchObject({ analyzed: 1, matched: 1, added: 1 });
    const upsert = fresh.calls.find((call) => call.table === "concurso_leads" && call.operation === "upsert")!;
    expect(upsert.payload).toEqual([expect.objectContaining({ notice_id: catalogRow.id, user_id: USER.id })]);

    const seen = createFakeSupabase({
      "concurso_notices.select": { data: [catalogRow], error: null },
      "concurso_leads.select": { data: [{ notice_id: catalogRow.id }], error: null },
    });
    const again = await scoreForUser(seen.client as never, USER.id, profileRow as never, { today: TODAY });
    expect(again.added).toBe(0);
    expect(seen.calls.some((call) => call.table === "concurso_leads" && call.operation === "upsert")).toBe(false);
  });

  it("uma fonte fora do ar não impede a outra", async () => {
    const zip = zipSync({ "20261029/DO3/530_20261029_24474987-1.xml": strToU8(xml("edital-abertura-cgu")) });
    const page = '<a href="/documents/1/2/S03102026.zip/x?download=true">S03</a>';
    const admin = createFakeSupabase({
      "concurso_source_runs.select": { data: [], error: null },
      "concurso_notices.upsert": { data: [{ id: "n1" }], error: null },
    });
    const fetcher = fakeFetcher({ text: async () => page, bytes: async () => zip });
    const result = await refreshCatalog(admin.client as never, { places: ["Votorantim/SP"], fetcher, today: TODAY });
    expect(result.added).toBe(1);
    expect(result.errors).toEqual(["Querido Diário: não respondeu a tempo"]);
    const saved = admin.calls.find((call) => call.table === "concurso_notices")!;
    expect(saved.payload).toEqual([expect.objectContaining({ source: "dou", external_id: "24474987" })]);
    expect(admin.calls.find((call) => call.table === "concurso_source_runs" && call.operation === "upsert")?.payload).toMatchObject({
      source: "dou",
      last_date: TODAY,
    });
  });
});

describe("Acompanhar e descartar", () => {
  const notice = { ...noticeToRow({ ...cgu(), dates: [{ kind: "prova", date: "2027-02-07", time: "08:00", note: "Provas objetivas" }] }), id: "n1", found_at: "" };
  const lead = {
    id: "6a1f0c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    user_id: USER.id,
    notice_id: "n1",
    role: "Auditor Federal de Finanças e Controle (AFFC) - Especialidade: Tecnologia da Informação - Ciência de Dados",
    score: 91,
    reasons: ["Nível superior", "Federal"],
    warnings: [],
    status: "nova",
    concurso_id: null,
    found_at: "",
    resolved_at: null,
  } as const;

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("vira concurso em Edital publicado, com o cronograma e o link oficial", () => {
    const plan = leadToConcurso(lead as never, notice as never);
    expect(plan.concurso).toMatchObject({
      organ: "Controladoria-Geral da União",
      role_title: lead.role,
      exam_board: "Cebraspe",
      education: "superior",
      stage: "edital_publicado",
      priority: "alta",
      registration_url: "http://www.cebraspe.org.br/concursos/cgu_26_affc",
    });
    expect(plan.concurso.notes).toContain("91% compatível");
    expect(plan.dates).toEqual([{ kind: "prova", date: "2027-02-07", time: "08:00", note: "Provas objetivas" }]);
  });

  it("Acompanhar cria o concurso, as datas e marca a sugestão", async () => {
    const fake = createFakeSupabase({
      "concurso_leads.select": { data: { ...lead, notice }, error: null },
      "concursos.insert": { data: { id: "c1" }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    expect(await followConcursoLead(lead.id)).toEqual({ ok: true, data: { concursoId: "c1" } });
    const tables = fake.calls.map((call) => `${call.table}.${call.operation}`);
    expect(tables).toEqual(["concurso_leads.select", "concursos.insert", "concurso_dates.insert", "concurso_leads.update"]);
    expect(fake.calls[3].payload).toMatchObject({ status: "acompanhando", concurso_id: "c1" });
  });

  it("descartar não mexe em concurso já acompanhado", async () => {
    const fake = createFakeSupabase({ "concurso_leads.update": { data: [{ id: lead.id }], error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    expect((await dismissConcursoLead(lead.id)).ok).toBe(true);
    expect(fake.calls[0].filters).toEqual(expect.arrayContaining([["user_id", USER.id], ["status !=", "acompanhando"]]));
  });
});

describe("perfil de concursos", () => {
  it("arruma as cidades no formato Cidade/UF", () => {
    expect(normalizePlace("belo horizonte - mg")).toBe("Belo Horizonte/MG");
    expect(normalizePlace("São José dos Campos/SP")).toBe("São José dos Campos/SP");
    expect(normalizePlace("Belo Horizonte")).toBeNull();
    expect(normalizePlace("Recife/XX")).toBeNull();
    expect(
      toConcursoProfilePayload({ ...emptyConcursoProfileFormValues, cities: ["contagem/mg", "Contagem/MG"], minSalary: "4.000,00" }),
    ).toMatchObject({ cities: ["Contagem/MG"], min_salary_cents: 400_000 });
  });
});

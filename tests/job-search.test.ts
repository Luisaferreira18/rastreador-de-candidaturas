import { describe, expect, it, vi } from "vitest";
import { COMPANY_BOARDS, boardKey, parseBoardInput } from "@/features/job-search/boards";
import { findUFs, findUFsInTitle, isBrazilLocation, toUF } from "@/features/job-search/brazil";
import { detectJobType, detectSeniority, detectWorkModel } from "@/features/job-search/classify";
import { leadToApplication, type JobLead } from "@/features/job-search/lead";
import { emptyJobProfileFormValues, jobProfileFormSchema, toJobProfilePayload } from "@/features/job-search/profile";
import { runSearchForUser } from "@/features/job-search/run";
import { MIN_SCORE, roleMatch, scoreJob } from "@/features/job-search/score";
import { buildSkipCheck, collectJobs, rankJobs, tasksForProfile, urlKey } from "@/features/job-search/search";
import { normalizeGreenhouseJob, normalizeLeverPosting } from "@/features/job-search/sources/boards";
import { gupyCompanyName, gupyQueryUrls, normalizeGupyJob, parseGupyResponse } from "@/features/job-search/sources/gupy";
import { SourceError } from "@/features/job-search/sources/http";
import { coreTerms, searchTerms } from "@/features/job-search/text";
import type { ScrapedJob, SearchProfile } from "@/features/job-search/types";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/types/database";

const TODAY = "2026-10-20";

const profile: SearchProfile = {
  roles: ["Estágio em Dados", "Estágio em Análise de Dados"],
  keywords: ["SQL", "Python", "Power BI"],
  excludedWords: ["vendas"],
  city: "São Paulo",
  state: "SP",
  workModels: ["presencial", "hibrido", "remoto"],
  jobTypes: ["estagio"],
  minSalaryCents: 150_000,
  useGupy: true,
  useCompanyBoards: true,
  extraBoards: [],
};

/** Formato real da busca pública da Gupy (out/2026). */
const gupyJob = {
  id: 12687159,
  name: "Estágio em Dados",
  applicationDeadline: "2026-12-05T00:00:00.000Z",
  description: "Você vai trabalhar com SQL e Python, criando dashboards no Power BI.",
  careerPageName: "Estágio Vertem",
  type: "vacancy_type_internship",
  publishedDate: "2026-10-16T18:10:25.749Z",
  workplaceType: "hybrid",
  city: "Barueri",
  state: "São Paulo",
  jobUrl: "https://estagiovertem.gupy.io/job/eyJqb2JJZCI6MTI2ODcxNTl9=?jobBoardSource=gupy_portal",
};

function job(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    source: "greenhouse",
    externalId: "1",
    company: "Stone",
    title: "Estágio em Dados",
    url: "https://job-boards.greenhouse.io/stone/jobs/1",
    location: "São Paulo, SP",
    city: null,
    state: null,
    workModel: "hibrido",
    jobType: "estagio",
    otherType: null,
    country: null,
    salaryCents: null,
    publishedAt: "2026-10-18T12:00:00Z",
    deadline: null,
    text: "",
    ...overrides,
  };
}

describe("textos e sinônimos", () => {
  it("compara cargos em português e inglês, sem nível nem palavras vazias", () => {
    expect(coreTerms("Estágio em Análise de Dados")).toEqual(["analise", "dados"]);
    expect(coreTerms("Data Analyst Jr")).toEqual(["dados", "analise"]);
    expect(coreTerms("Desenvolvedor(a) Front-end")).toEqual(["desenvolvimento", "frontend"]);
    expect(searchTerms("Estágio em Dados")).toBe("dados");
    // "Treinamento e Desenvolvimento" é RH, não programação.
    expect(coreTerms("Estagiário de Treinamento e Desenvolvimento (RH)")).toEqual(["rh"]);
  });

  it("no empate, mostra o cargo do perfil com mais palavras em comum", () => {
    expect(roleMatch("Estagiário de Análise de Dados", profile.roles)).toEqual({
      fraction: 1,
      role: "Estágio em Análise de Dados",
    });
    expect(roleMatch("Estágio em Marketing", profile.roles).fraction).toBe(0);
  });
});

describe("tipo, nível e modelo pelo texto", () => {
  it("reconhece estágio sem confundir com Internal Audit", () => {
    expect(detectJobType("Estagiário(a) de Dados")).toBe("estagio");
    expect(detectJobType("Data Intern")).toBe("estagio");
    expect(detectJobType("INTERNAL AUDIT IT ANALYST I")).toBeNull();
    expect(detectJobType("Analista PJ")).toBe("pj");
    expect(detectJobType("Programa Trainee 2027")).toBe("trainee");
  });

  it("reconhece nível e modelo de trabalho", () => {
    expect(detectSeniority("Analista de Dados Sênior")).toBe("senior");
    expect(detectSeniority("Engineer III")).toBe("senior");
    expect(detectSeniority("Coordenador de BI")).toBe("lideranca");
    expect(detectSeniority("Analista de Dados Jr")).toBe("junior");
    expect(detectWorkModel("Account Executive (Híbrido/SP)")).toBe("hibrido");
    expect(detectWorkModel("Brazil (Remote)")).toBe("remoto");
    expect(detectWorkModel("Curitiba | On-site")).toBe("presencial");
  });
});

describe("local das vagas", () => {
  it("separa Brasil de outros países", () => {
    expect(isBrazilLocation("Sao Paulo, Sao Paulo, Brasil")).toBe(true);
    expect(isBrazilLocation("Belo Horizonte, MG")).toBe(true);
    expect(isBrazilLocation("Mexico City, Mexico City, Mexico")).toBe(false);
    expect(isBrazilLocation("Germany (Berlin - Hybrid)")).toBe(false);
    expect(isBrazilLocation("Remote")).toBeNull();
    expect(isBrazilLocation("Remote", "BR")).toBe(true);
    expect(isBrazilLocation("Montevideo (Hybrid)", "UY")).toBe(false);
  });

  it("acha o estado pela sigla, pelo nome ou pela cidade", () => {
    expect(toUF("São Paulo")).toBe("SP");
    expect(toUF("rj")).toBe("RJ");
    expect(findUFs("Belo Horizonte, MG; Curitiba, PR").sort()).toEqual(["MG", "PR"]);
    expect(findUFs("Florianópolis, Santa Catarina, Brasil (Híbrido)")).toEqual(["SC"]);
    expect(findUFs("Curitiba | On-site")).toEqual(["PR"]);
    expect(findUFsInTitle("Vendedor Externo Júnior | João Pessoa/PB")).toEqual(["PB"]);
    // Palavras em maiúsculas no título não viram estado.
    expect(findUFsInTitle("HEAD TO MARKET AL")).toEqual([]);
  });
});

describe("Gupy", () => {
  it("converte a vaga e limpa o nome da empresa", () => {
    expect(normalizeGupyJob(gupyJob)).toMatchObject({
      source: "gupy",
      externalId: "12687159",
      company: "Vertem",
      title: "Estágio em Dados",
      location: "Barueri, SP",
      city: "Barueri",
      state: "SP",
      workModel: "hibrido",
      jobType: "estagio",
      otherType: null,
      deadline: "2026-12-05",
    });
    expect(gupyCompanyName("Youse Seguros | Programa de Estágio 2026", undefined)).toBe("Youse Seguros");
    expect(gupyCompanyName("KOVI ❤️", undefined)).toBe("KOVI");
    expect(gupyCompanyName("Instituto Infnet - Venha ser estagiário ou trainee!", undefined)).toBe("Instituto Infnet");
    expect(gupyCompanyName("Venha construir o futuro com a gente!", "https://vagas-mrveco.gupy.io/job/1")).toBe("Mrveco");
  });

  it("banco de talentos e jovem aprendiz ficam marcados como outro tipo", () => {
    expect(normalizeGupyJob({ ...gupyJob, type: "vacancy_type_talent_pool" })?.otherType).toBe("Banco de talentos");
    expect(normalizeGupyJob({ ...gupyJob, type: "vacancy_type_apprentice" })?.otherType).toBe("Jovem aprendiz");
  });

  it("recusa resposta em formato inesperado", () => {
    expect(() => parseGupyResponse({ erro: true })).toThrow(SourceError);
    expect(parseGupyResponse({ data: [gupyJob, { id: 2 }] })).toHaveLength(1);
  });

  it("monta uma consulta por cargo, no estado e nas remotas", () => {
    const urls = gupyQueryUrls({ ...profile, roles: ["Estágio em Dados"], jobTypes: ["estagio", "trainee"] });
    expect(urls).toHaveLength(2);
    const [inState, remote] = urls.map((url) => new URL(url).searchParams);
    expect(inState.get("jobName")).toBe("dados");
    expect(inState.get("type")).toBe("vacancy_type_internship,vacancy_type_trainee");
    expect(inState.get("state")).toBe("São Paulo");
    expect(remote.get("workplaceType")).toBe("remote");

    // Sem estado, uma consulta só (que já inclui as remotas).
    expect(gupyQueryUrls({ ...profile, roles: ["Estágio em Dados"], state: null, city: null })).toHaveLength(1);
    // Só remoto: só a consulta de remotas.
    const onlyRemote = gupyQueryUrls({ ...profile, roles: ["Estágio em Dados"], workModels: ["remoto"] });
    expect(onlyRemote.map((url) => new URL(url).searchParams.get("workplaceType"))).toEqual(["remote"]);
  });
});

describe("Greenhouse e Lever", () => {
  const stone = COMPANY_BOARDS.find((board) => board.slug === "stone")!;

  it("Greenhouse: usa o nome da lista pronta e deduz tipo e modelo do título", () => {
    const result = normalizeGreenhouseJob(
      {
        id: 8007019003,
        title: "Estágio em Dados (Híbrido/SP)",
        absolute_url: "https://job-boards.greenhouse.io/stone/jobs/8007019003",
        location: { name: "Sao Paulo, Sao Paulo, Brasil" },
        first_published: "2026-10-13T10:33:50-04:00",
      },
      stone,
    );
    expect(result).toMatchObject({ company: "Stone", jobType: "estagio", workModel: "hibrido", externalId: "8007019003" });
  });

  it("Lever: modelo, país e salário em reais por mês", () => {
    const result = normalizeLeverPosting(
      {
        id: "abc",
        text: "Estágio em Engenharia de Dados",
        hostedUrl: "https://jobs.lever.co/ciandt/abc",
        createdAt: Date.UTC(2026, 9, 18),
        country: "BR",
        workplaceType: "remote",
        categories: { commitment: "Estágio", location: "Brazil", department: "Dados" },
        descriptionPlain: "SQL e Python no dia a dia.",
        salaryRange: { currency: "BRL", interval: "per-month-salary", min: 2200, max: 2500 },
      },
      { source: "lever", slug: "ciandt", company: "CI&T" },
    );
    expect(result).toMatchObject({
      company: "CI&T",
      jobType: "estagio",
      workModel: "remoto",
      country: "BR",
      salaryCents: 220_000,
      publishedAt: "2026-10-18T00:00:00.000Z",
    });
    expect(result?.text).toContain("SQL e Python");
  });

  it("entende links de páginas de vagas", () => {
    expect(parseBoardInput("https://boards.greenhouse.io/nubank")).toEqual({ source: "greenhouse", slug: "nubank" });
    expect(parseBoardInput("job-boards.greenhouse.io/stone/jobs/123")).toEqual({ source: "greenhouse", slug: "stone" });
    expect(parseBoardInput("https://boards.greenhouse.io/embed/job_board?for=vtex")).toEqual({ source: "greenhouse", slug: "vtex" });
    expect(parseBoardInput("https://jobs.lever.co/ciandt/201a7aec")).toEqual({ source: "lever", slug: "ciandt" });
    expect(parseBoardInput("lever:Neon")).toEqual({ source: "lever", slug: "neon" });
    expect(parseBoardInput("https://www.linkedin.com/jobs/view/123")).toBeNull();
    expect(boardKey({ source: "greenhouse", slug: "stone" })).toBe("greenhouse:stone");
  });
});

describe("nota de compatibilidade", () => {
  it("vaga ideal: nota alta e os motivos em ordem", () => {
    const match = scoreJob(
      job({ title: "Estagiário de Análise de Dados", text: "SQL, Python e Power BI", salaryCents: 180_000 }),
      profile,
      TODAY,
    );
    expect(match).toEqual({
      excluded: false,
      score: 100,
      reasons: ["Cargo: Estágio em Análise de Dados", "Estágio", "Híbrido em São Paulo, SP", "SQL, Python, Power BI", formatCurrency(180_000)],
      warnings: [],
    });
  });

  it("mesmo estado, outra cidade: vale menos; outra cidade de outro estado: fica de fora", () => {
    const sameState = scoreJob(job({ location: "Campinas, SP", text: "SQL Python Power BI" }), profile, TODAY);
    expect(sameState.excluded).toBe(false);
    if (!sameState.excluded) expect(sameState.score).toBe(92);
    expect(scoreJob(job({ location: "Belo Horizonte, MG" }), profile, TODAY)).toEqual({
      excluded: true,
      reason: "Em outra cidade",
    });
    // Remota vale de qualquer lugar.
    expect(scoreJob(job({ location: "Recife, PE", workModel: "remoto" }), profile, TODAY).excluded).toBe(false);
  });

  it("deixa de fora o que claramente não serve", () => {
    const reason = (overrides: Partial<ScrapedJob>, custom: Partial<SearchProfile> = {}) => {
      const match = scoreJob(job(overrides), { ...profile, ...custom }, TODAY);
      return match.excluded ? match.reason : null;
    };
    expect(reason({ title: "Estágio em Marketing" })).toBe("Cargo diferente do perfil");
    expect(reason({ title: "Analista de Dados", jobType: null })).toBe("Não diz que é estágio ou trainee");
    expect(reason({ jobType: "clt" })).toBe("Vaga de CLT");
    expect(reason({ title: "Estágio em Dados e Vendas" })).toBe('Título com "vendas"');
    expect(reason({ location: "Mexico City, Mexico" })).toBe("Vaga fora do Brasil");
    expect(reason({ deadline: "2026-10-19" })).toBe("Inscrições encerradas");
    expect(reason({ otherType: "Banco de talentos" })).toBe("Banco de talentos");
    expect(reason({ workModel: "presencial" }, { workModels: ["remoto", "hibrido"] })).toBe("Vaga presencial");
    // Quem procura CLT sem dizer o nível não recebe vagas sênior.
    expect(
      reason({ title: "Analista de Dados Sênior", jobType: null }, { roles: ["Analista de Dados"], jobTypes: ["clt"] }),
    ).toBe("Vaga de nível sênior");
    expect(
      reason({ title: "Analista de Dados Sênior", jobType: null }, { roles: ["Analista de Dados Sênior"], jobTypes: ["clt"] }),
    ).toBeNull();
  });

  it("remuneração abaixo do mínimo vira aviso e desconta pontos", () => {
    const match = scoreJob(job({ salaryCents: 120_000, text: "SQL Python Power BI" }), profile, TODAY);
    expect(match).toMatchObject({ excluded: false, score: 85, warnings: [`${formatCurrency(120_000)}: abaixo do seu mínimo`] });
  });

  it("tipo desconhecido vale metade para quem também aceita CLT", () => {
    const match = scoreJob(
      job({ title: "Analista de Dados", jobType: null }),
      { ...profile, roles: ["Analista de Dados"], jobTypes: ["clt", "pj"], keywords: [] },
      TODAY,
    );
    expect(match).toMatchObject({ excluded: false, score: 88 });
  });
});

describe("busca", () => {
  it("baixa as fontes, junta repetidas e registra a fonte que falhou", async () => {
    const tasks = tasksForProfile({ ...profile, roles: ["Estágio em Dados"], useCompanyBoards: false, extraBoards: [{ source: "lever", slug: "fora-do-ar" }] });
    expect(tasks.map((task) => task.label)).toEqual(["Gupy", "Gupy", "fora-do-ar (Lever)"]);

    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("lever")) throw new SourceError("não respondeu a tempo");
      return { data: [gupyJob] };
    });
    const { jobs, errors } = await collectJobs(tasks, fetchJson);
    expect(jobs).toHaveLength(1);
    expect(errors).toEqual(["fora-do-ar (Lever): não respondeu a tempo"]);
  });

  it("reaproveita o download entre perfis (cron)", async () => {
    const tasks = tasksForProfile({ ...profile, useGupy: false, extraBoards: [] });
    expect(tasks).toHaveLength(COMPANY_BOARDS.length);
    const fetchJson = vi.fn(async (url: string) => (url.includes("lever") ? [] : { jobs: [] }));
    const cache = new Map();
    await collectJobs(tasks, fetchJson, cache);
    await collectJobs(tasks, fetchJson, cache);
    expect(fetchJson).toHaveBeenCalledTimes(COMPANY_BOARDS.length);
  });

  it("ordena pela nota e não repete vagas já sugeridas ou já no quadro", () => {
    const jobs = [
      job({ externalId: "a", title: "Estágio em Dados", text: "SQL" }),
      job({ externalId: "b", title: "Estagiário de Análise de Dados", text: "SQL Python Power BI" }),
      job({ externalId: "c", title: "Estágio em Dados", company: "Inter", url: "https://job-boards.greenhouse.io/inter/jobs/9?gh_src=x" }),
      job({ externalId: "d", title: "Estágio em Marketing" }),
    ];
    const ranked = rankJobs(jobs, profile, TODAY);
    expect(ranked.map((item) => item.externalId)).toEqual(["b", "a", "c"]);
    expect(ranked.every((item) => item.score >= MIN_SCORE)).toBe(true);

    const skip = buildSkipCheck(
      [{ source: "greenhouse", external_id: "a" }],
      [{ company: "Inter", role_title: "Outro cargo", job_url: "https://job-boards.greenhouse.io/inter/jobs/9" }],
    );
    expect(ranked.filter((item) => !skip(item)).map((item) => item.externalId)).toEqual(["b"]);
    expect(urlKey("https://x.gupy.io/job/abc=?jobBoardSource=gupy_portal")).toBe("x.gupy.io/job/abc=");
  });
});

/** Cliente falso só com o que a busca usa (select, upsert, update). */
function fakeClient(existingLeads: { source: string; external_id: string }[] = []) {
  const calls: { table: string; op: string; payload?: unknown; options?: unknown }[] = [];
  const builder = (table: string) => {
    let op = "select";
    let payload: unknown;
    let options: unknown;
    const self = {
      select: () => self,
      eq: () => self,
      limit: () => self,
      upsert: (rows: unknown, opts: unknown) => ((op = "upsert"), (payload = rows), (options = opts), self),
      update: (patch: unknown) => ((op = "update"), (payload = patch), self),
      then(resolve: (value: unknown) => void) {
        calls.push({ table, op, payload, options });
        if (table === "job_leads" && op === "select") return resolve({ data: existingLeads, error: null });
        if (table === "applications") return resolve({ data: [], error: null });
        if (op === "upsert") return resolve({ data: (payload as unknown[]).map((_, index) => ({ id: String(index) })), error: null });
        return resolve({ data: null, error: null });
      },
    };
    return self;
  };
  return { client: { from: builder } as never, calls };
}

describe("runSearchForUser", () => {
  const row = {
    user_id: "u1",
    roles: ["Estágio em Dados"],
    keywords: ["SQL"],
    excluded_words: [],
    city: "São Paulo",
    state: "SP",
    work_models: ["presencial", "hibrido", "remoto"],
    job_types: ["estagio"],
    min_salary_cents: null,
    use_gupy: true,
    use_company_boards: false,
    extra_boards: [],
    auto_search: true,
    last_run_at: null,
    last_run_stats: null,
    created_at: "2026-10-20T00:00:00Z",
    updated_at: "2026-10-20T00:00:00Z",
  } satisfies Tables<"job_profiles">;

  it("grava só as vagas novas, sem sobrescrever as já vistas, e guarda o resumo", async () => {
    const { client, calls } = fakeClient([{ source: "gupy", external_id: "999" }]);
    const fetchJson = vi.fn(async () => ({
      data: [gupyJob, { ...gupyJob, id: 999 }, { ...gupyJob, id: 3, name: "Estágio em Vendas" }],
    }));
    const stats = await runSearchForUser(client, "u1", row, { fetchJson, today: TODAY });

    const upsert = calls.find((call) => call.op === "upsert")!;
    expect(upsert.options).toEqual({ onConflict: "user_id,source,external_id", ignoreDuplicates: true });
    expect(upsert.payload).toEqual([
      expect.objectContaining({ user_id: "u1", source: "gupy", external_id: "12687159", company: "Vertem", score: expect.any(Number) }),
    ]);
    expect(stats).toMatchObject({ analyzed: 3, matched: 2, added: 1, sources: 2, errors: [] });
    const saved = calls.find((call) => call.table === "job_profiles" && call.op === "update")!;
    expect(saved.payload).toMatchObject({ last_run_stats: { added: 1 } });
  });
});

describe("perfil e candidatura", () => {
  it("valida o perfil e guarda as páginas extras no formato curto", () => {
    const empty = jobProfileFormSchema.safeParse(emptyJobProfileFormValues);
    expect(empty.success).toBe(false);

    const values = {
      ...emptyJobProfileFormValues,
      roles: ["Estágio em Dados", "estágio em dados"],
      keywords: ["SQL", "sql", "Python"],
      minSalary: "1.500,00",
      extraBoards: ["https://boards.greenhouse.io/nubank"],
    };
    expect(jobProfileFormSchema.safeParse(values).success).toBe(true);
    expect(toJobProfilePayload(values)).toMatchObject({
      roles: ["Estágio em Dados"],
      keywords: ["SQL", "Python"],
      min_salary_cents: 150_000,
      extra_boards: ["greenhouse:nubank"],
      state: null,
    });
    expect(
      jobProfileFormSchema.safeParse({ ...values, useGupy: false, useCompanyBoards: false, extraBoards: [] }).success,
    ).toBe(false);
    expect(jobProfileFormSchema.safeParse({ ...values, extraBoards: ["https://linkedin.com/jobs/1"] }).success).toBe(false);
  });

  it("vaga sugerida vira candidatura em Quero me candidatar", () => {
    const lead = {
      id: "l1",
      user_id: "u1",
      source: "gupy",
      external_id: "12687159",
      company: "Vertem",
      title: "Estágio em Dados",
      url: gupyJob.jobUrl,
      location: "Barueri, SP",
      work_model: "hibrido",
      job_type: "estagio",
      salary_cents: null,
      published_at: null,
      deadline: "2026-12-05",
      score: 92,
      reasons: ["Cargo: Estágio em Dados", "Estágio"],
      warnings: [],
      status: "nova",
      application_id: null,
      found_at: "2026-10-20T09:00:00Z",
      resolved_at: null,
    } satisfies JobLead;
    expect(leadToApplication(lead, ["estagio"])).toMatchObject({
      company: "Vertem",
      role_title: "Estágio em Dados",
      job_type: "estagio",
      job_url: gupyJob.jobUrl,
      platform: "gupy",
      location: "Barueri, SP",
      work_model: "hibrido",
      stage: "quero_candidatar",
      priority: "alta",
      notes: expect.stringContaining("Inscrições até 05/12/2026."),
    });
    expect(leadToApplication({ ...lead, source: "lever", job_type: null, score: 70 }, ["trainee"])).toMatchObject({
      platform: "site_empresa",
      job_type: "trainee",
      priority: "media",
    });
  });
});

describe("GET /api/cron/vagas", () => {
  it("exige o segredo do cron", async () => {
    process.env.CRON_SECRET = "segredo-cron";
    const { GET } = await import("@/app/api/cron/vagas/route");
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest("http://localhost/api/cron/vagas"));
    expect(response.status).toBe(401);
    const wrong = await GET(new NextRequest("http://localhost/api/cron/vagas", { headers: { authorization: "Bearer x" } }));
    expect(wrong.status).toBe(401);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { citedCourses, degreeDemand, educationFit, graduationWindow } from "@/features/job-search/education";
import { toSearchProfile } from "@/features/job-search/profile";
import { runSearchForUser } from "@/features/job-search/run";
import { scoreJob } from "@/features/job-search/score";
import { leadsBlockedByResume } from "@/features/job-search/search";
import { fold } from "@/features/job-search/text";
import type { ResumeEducation, ScrapedJob, SearchProfile } from "@/features/job-search/types";
import type { Tables } from "@/types/database";
import { createFakeSupabase } from "./support/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { getCurrentUser } = await import("@/features/auth/session");
const { createClient } = await import("@/lib/supabase/server");
const { updateResumeEducation } = await import("@/features/resume/actions");

const TODAY = "2026-11-06";
const YEAR = 2026;
const STUDENT: ResumeEducation = { course: "Sistemas de Informação", status: "cursando", graduationYear: 2027 };

/** Os textos abaixo vieram de descrições reais da Gupy (nov/2026). */
describe("a vaga pede curso superior terminado?", () => {
  it.each([
    "requisitos e qualificacoesensino superior completo;python intermediario",
    "formacaosuperior completo, porem todos os cursos sao bem-vindos.",
    "requisitos necessarios:graduacao completa em curso de nivel superior na area de tecnologia",
    "requisitos e qualificacoesgraduacao concluidoexcel avancadopower bi",
    "ensino superior concluido em administracao, logistica, engenharia, economia ou areas afins;",
    "experiencia anterior em supervisao de equipeensino superior completo em administracao",
    "solucoes inovadoras e diferenciados. requisitos e qualificacoesensino superior completoexperiencia em processos",
    "Bachelor's degree in Computer Science",
    "ser formado(a) em administracao",
  ])("exigido: %s", (text) => {
    expect(degreeDemand(fold(text))).toBe("exigido");
  });

  it.each([
    "formacao em ensino superior completo ou em andamento em administracao",
    "formacao superior completa ou cursando em ciencia da computacao",
    "ensino superior em andamento ou completo em administracao",
    "ensino superior cursando ou completo em administracao",
    "ensino superior cursando (ou completo) em administracao",
    "graduacao em andamento ou concluida em administracao",
    "desejavel ensino superior completo/em andamento em administracao",
    "formacao superior incompleto em administracao e afins",
    "ensino medio completo. boa comunicacao",
    "2º grau completo. competencias boa comunicacao",
    "pos-graduacao, mba ou especializacao concluida",
    "programa para quem nao tem ensino superior completo",
    "ensino tecnico ou superior completo",
    "uma equipe formada em 2010 por especialistas",
    "formado por profissionais que lideram suas areas",
    "currently pursuing a bachelor's degree",
  ])("não exigido: %s", (text) => {
    expect(degreeDemand(fold(text))).toBeNull();
  });

  it("desejável vira aviso; sem dizer se é completo, fica a dúvida", () => {
    expect(degreeDemand(fold("diferencial: ensino superior completo"))).toBe("desejavel");
    expect(degreeDemand(fold("requisitos:formacao superior em ciencia de dados, estatistica"))).toBe("provavel");
    expect(degreeDemand(fold("graduacao em administracao, contabilidade ou areas correlatas"))).toBe("provavel");
    expect(degreeDemand(fold("desejavel ensino tecnico ou superior em administracao"))).toBeNull();
    expect(degreeDemand(fold("cursando graduacao em administracao"))).toBeNull();
  });
});

describe("período de formatura", () => {
  it.each([
    ["previsao de formacao a partir de dezembro de 2028. disponibilidade", { from: 2028, to: null }],
    ["previsao de conclusao a partir do 2º semestre de 2027) nocoes de dados", { from: 2027, to: null }],
    ["previsao de formatura a partir de abril/2027.alguma nocao de sql", { from: 2027, to: null }],
    ["formacao prevista para a partir de 12/2027;tenham muita atencao", { from: 2027, to: null }],
    ["com previsao de formatura para 2028.1 ou apos.necessario", { from: 2028, to: null }],
    ["conclusao: no 1° semestre de 2027 ate o 1° semestre de 2029.informacoes", { from: 2027, to: 2029 }],
    ["com formacao entre dezembro de 2028/2029);disponibilidade", { from: 2028, to: 2029 }],
    ["com formacao entre dezembro/2024 a dezembro/2026.administracao", { from: 2024, to: 2026 }],
    ["previsao de conclusao do curso entre dezembro de 2027 e dezembro de 2028.ter", { from: 2027, to: 2028 }],
    ["formatura prevista para 2027 ou 2028); disponibilidade", { from: 2027, to: 2028 }],
    ["com formacao prevista em dezembro/2028;conhecimento", { from: 2028, to: 2028 }],
    ["formados ate 2026, com disponibilidade", { from: null, to: 2026 }],
  ])("%s", (text, expected) => {
    expect(graduationWindow(fold(text))).toEqual(expected);
  });

  it("sem data de formatura, não há período", () => {
    expect(graduationWindow(fold("conclusao de projetos ate 2027"))).toBeNull();
    expect(graduationWindow(fold("empresa fundada em 2020, inicio em janeiro de 2027"))).toBeNull();
    expect(graduationWindow(fold("previsao de formatura proxima"))).toBeNull();
  });
});

describe("cursos que a vaga lista", () => {
  it("lê a lista fechada", () => {
    expect(citedCourses(fold("cursando ciencias contabeis, administracao ou economia;"))).toEqual(
      expect.arrayContaining(["Ciências Contábeis", "Administração", "Ciências Econômicas"]),
    );
    expect(citedCourses(fold("ensino superior cursando em marketing;ser comunicativo"))).toEqual(["Marketing"]);
  });

  it("lista aberta, desejável ou fora de contexto não conta", () => {
    expect(citedCourses(fold("cursando administracao, economia ou areas afins"))).toEqual([]);
    expect(citedCourses(fold("graduacao completa em administracao ou correlatos"))).toEqual([]);
    expect(citedCourses(fold("desejavel cursando ensino superior em administracao"))).toEqual([]);
    expect(citedCourses(fold("cursando uma graduacao, em qualquer area de formacao"))).toEqual([]);
    expect(citedCourses(fold("oferecemos acesso a cursos de marketing e direito"))).toEqual([]);
    expect(citedCourses(fold("se voce esta comecando sua graduacao e quer uma carreira em uma area dinamica, com logistica"))).toEqual([]);
  });
});

describe("a vaga combina com a formação da pessoa?", () => {
  const fit = (text: string, jobType: ScrappedType, education: ResumeEducation | null = STUDENT) =>
    educationFit(fold(text), jobType, education, YEAR);
  type ScrappedType = ScrapedJob["jobType"];

  it("quem se forma ano que vem não recebe vaga que exige superior completo", () => {
    expect(fit("Requisitos: ensino superior completo em Sistemas de Informação.", "clt").excluded).toBe("Pede ensino superior completo");
  });

  it("mas recebe a que aceita quem está cursando", () => {
    expect(fit("Ensino superior completo ou cursando em Sistemas de Informação.", "clt")).toEqual({
      excluded: null,
      warnings: [],
      otherCourse: false,
    });
  });

  it("quem se forma este ano decide: fica com aviso", () => {
    const result = fit("Ensino superior completo.", "clt", { ...STUDENT, graduationYear: YEAR });
    expect(result.excluded).toBeNull();
    expect(result.warnings).toEqual([`Pede superior completo: sua formatura é em ${YEAR}`]);
  });

  it("quem já se formou não perde nada por causa disso", () => {
    const graduated: ResumeEducation = { course: "Sistemas de Informação", status: "concluido", graduationYear: 2024 };
    expect(fit("Ensino superior completo.", "clt", graduated).excluded).toBeNull();
    expect(fit("Vaga de estágio.", "estagio", graduated).warnings).toEqual([
      "Estágio pede matrícula ativa: seu currículo diz curso concluído",
    ]);
  });

  it("estágio é para quem estuda, diga o que disser a descrição", () => {
    expect(fit("Ensino superior completo será bem-vindo.", "estagio").excluded).toBeNull();
  });

  it("período de formatura: dentro passa, fora sai, com o motivo", () => {
    expect(fit("Previsão de formatura a partir de 12/2027.", "estagio").excluded).toBeNull();
    expect(fit("Previsão de formatura a partir de junho/2028.", "estagio").excluded).toBe("Pede formatura a partir de 2028, e a sua é em 2027");
    expect(fit("Formação entre dezembro/2024 a dezembro/2026.", "trainee").excluded).toBe("Pede formatura entre 2024 e 2026, e a sua é em 2027");
    // Sem o ano de formatura, não dá para comparar.
    expect(fit("Previsão de formatura a partir de 2028.", "estagio", { ...STUDENT, graduationYear: null }).excluded).toBeNull();
  });

  it("curso de outra área vira aviso; curso parecido, não", () => {
    const other = fit("Cursando Administração ou Ciências Contábeis.", "estagio");
    expect(other.excluded).toBeNull();
    expect(other.otherCourse).toBe(true);
    expect(other.warnings).toEqual(["A vaga cita Administração, Ciências Contábeis: seu curso é Sistemas de Informação"]);
    expect(fit("Cursando Ciência da Computação.", "estagio").otherCourse).toBe(false);
    expect(fit("Cursando Engenharia.", "estagio", { ...STUDENT, course: "Engenharia de Produção" }).otherCourse).toBe(false);
  });

  it("sem currículo ou sem a situação do curso, nada muda", () => {
    expect(fit("Ensino superior completo.", "clt", null).excluded).toBeNull();
    expect(fit("Ensino superior completo.", "clt", { course: null, status: null, graduationYear: null })).toEqual({
      excluded: null,
      warnings: [],
      otherCourse: false,
    });
  });
});

const profile: SearchProfile = {
  roles: ["Analista de Dados"],
  keywords: [],
  excludedWords: [],
  city: null,
  state: null,
  workModels: ["presencial", "hibrido", "remoto"],
  jobTypes: ["estagio", "clt"],
  minSalaryCents: null,
  useGupy: true,
  useCompanyBoards: false,
  extraBoards: [],
  resumeSkills: [],
  resumeLanguages: [],
  resumeEducation: STUDENT,
  resumeExperience: null,
};

function job(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    source: "gupy",
    externalId: "1",
    company: "Empresa",
    title: "Analista de Dados",
    url: "https://empresa.gupy.io/job/1",
    location: "Remoto",
    city: null,
    state: null,
    workModel: "remoto",
    jobType: "clt",
    otherType: null,
    country: "BR",
    salaryCents: null,
    publishedAt: null,
    deadline: null,
    benefits: [],
    workload: null,
    detailUrl: null,
    text: "",
    ...overrides,
  };
}

describe("na nota da vaga", () => {
  it("a vaga que exige superior completo sai da lista, com o motivo", () => {
    expect(scoreJob(job({ text: "Ensino superior completo." }), profile, TODAY)).toEqual({
      excluded: true,
      reason: "Pede ensino superior completo",
    });
    expect(scoreJob(job({ text: "Ensino superior completo ou cursando." }), profile, TODAY).excluded).toBe(false);
  });

  it("curso de outra área desconta pontos e avisa", () => {
    const same = scoreJob(job({ text: "Cursando Sistemas de Informação." }), profile, TODAY);
    const other = scoreJob(job({ text: "Cursando Direito." }), profile, TODAY);
    if (same.excluded || other.excluded) throw new Error("não deveria sair da lista");
    expect(other.score).toBe(same.score - 15);
    expect(other.warnings).toEqual(["A vaga cita Direito: seu curso é Sistemas de Informação"]);
  });
});

describe("toSearchProfile", () => {
  const row = { roles: [], keywords: [], excluded_words: [], extra_boards: [], work_models: [], job_types: [] } as unknown as Tables<"job_profiles">;
  const resume = { skills: [], languages: [], course: "Direito", graduation_year: 2027, experience_months: null };

  it("leva a formação do currículo para a busca", () => {
    expect(toSearchProfile(row, { ...resume, education_status: "cursando" }).resumeEducation).toEqual({
      course: "Direito",
      status: "cursando",
      graduationYear: 2027,
    });
    expect(toSearchProfile(row, { ...resume, education_status: "??" as never }).resumeEducation?.status).toBeNull();
    expect(toSearchProfile(row).resumeEducation).toBeNull();
  });
});

describe("sugestões antigas", () => {
  const lead = (id: string, external_id: string, status = "nova") => ({ id, source: "gupy", external_id, status });

  it("só sai a sugestão sem resposta que a formação descarta", async () => {
    const jobs = [
      job({ externalId: "completo", text: "Ensino superior completo." }),
      job({ externalId: "cursando", text: "Superior completo ou cursando." }),
      job({ externalId: "descartada", text: "Ensino superior completo." }),
    ];
    const ids = await leadsBlockedByResume(
      [lead("a", "completo"), lead("b", "cursando"), lead("c", "descartada", "descartada"), lead("d", "sumiu")],
      jobs,
      profile,
      TODAY,
      vi.fn(),
    );
    expect(ids).toEqual(["a"]);
  });

  it("baixa a descrição que falta (Greenhouse); se falhar, a sugestão fica", async () => {
    const detailUrl = "https://boards-api.greenhouse.io/v1/boards/x/jobs/1";
    const jobs = [job({ source: "greenhouse", externalId: "1", detailUrl })];
    const leads = [{ id: "a", source: "greenhouse", external_id: "1", status: "nova" }];
    const found = vi.fn(async () => ({ content: "&lt;p&gt;Ensino superior completo.&lt;/p&gt;" }));
    expect(await leadsBlockedByResume(leads, jobs, profile, TODAY, found)).toEqual(["a"]);
    const broken = vi.fn(async () => {
      throw new Error("fora do ar");
    });
    expect(await leadsBlockedByResume(leads, jobs, profile, TODAY, broken)).toEqual([]);
  });

  it("sem currículo, nada sai e nada é baixado", async () => {
    const fetchJson = vi.fn();
    const jobs = [job({ externalId: "x", text: "Ensino superior completo.", detailUrl: "https://exemplo.com" })];
    expect(await leadsBlockedByResume([lead("a", "x")], jobs, { ...profile, resumeEducation: null, resumeExperience: null }, TODAY, fetchJson)).toEqual([]);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("a busca apaga essas sugestões e não grava vaga que exige superior completo", async () => {
    const calls: { table: string; op: string; payload?: unknown; filters: unknown[][] }[] = [];
    const client = {
      from(table: string) {
        const call = { table, op: "select", payload: undefined as unknown, filters: [] as unknown[][] };
        const self = {
          select: () => self,
          eq: (...args: unknown[]) => (call.filters.push(args), self),
          in: (...args: unknown[]) => (call.filters.push(args), self),
          limit: () => self,
          maybeSingle: () => self,
          delete: () => ((call.op = "delete"), self),
          upsert: (rows: unknown) => ((call.op = "upsert"), (call.payload = rows), self),
          update: (patch: unknown) => ((call.op = "update"), (call.payload = patch), self),
          then(resolve: (value: unknown) => void) {
            calls.push(call);
            if (table === "job_leads" && call.op === "select") return resolve({ data: [lead("velha", "1")], error: null });
            if (table === "applications") return resolve({ data: [], error: null });
            if (table === "resumes") {
              return resolve({
                data: { skills: [], languages: [], course: "Sistemas de Informação", education_status: "cursando", graduation_year: 2027, experience_months: null },
                error: null,
              });
            }
            return resolve({ data: [], error: null });
          },
        };
        return self;
      },
    } as never;
    const gupy = (id: number, description: string) => ({
      id,
      name: "Estágio em Dados",
      description,
      careerPageName: "Empresa",
      type: "vacancy_type_internship",
      publishedDate: "2026-10-16T18:10:25.749Z",
      workplaceType: "remote",
      jobUrl: `https://empresa.gupy.io/job/${id}`,
    });
    const row = {
      roles: ["Estágio em Dados"],
      keywords: [],
      excluded_words: [],
      city: null,
      state: null,
      work_models: ["remoto"],
      job_types: ["estagio"],
      min_salary_cents: null,
      use_gupy: true,
      use_company_boards: false,
      extra_boards: [],
    } as unknown as Tables<"job_profiles">;
    const fetchJson = vi.fn(async () => ({
      data: [gupy(1, "Previsão de formatura a partir de 2029."), gupy(2, "Previsão de formatura a partir de 2030."), gupy(3, "Formatura a partir de 2027.")],
    }));

    const stats = await runSearchForUser(client, "u1", row, { fetchJson, today: TODAY });

    expect(calls.find((call) => call.op === "delete")).toMatchObject({
      table: "job_leads",
      filters: [["id", ["velha"]], ["status", "nova"]],
    });
    const upsert = calls.find((call) => call.op === "upsert");
    expect(upsert?.payload).toEqual([expect.objectContaining({ external_id: "3" })]);
    expect(stats).toMatchObject({ analyzed: 3, matched: 1 });
  });
});

describe("corrigir a formação", () => {
  const USER = { id: "u1", email: "ana@exemplo.com", name: "Ana", avatarUrl: null, isDemo: false };
  const VALUES = { course: "Direito", status: "cursando", graduationYear: 2027, experienceMonths: 6 } as const;

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("salva, refaz as sugestões e libera uma busca nova", async () => {
    const fake = createFakeSupabase({
      "resumes.select": { data: { skills: ["SQL", "Python"] }, error: null },
      "resumes.update": { data: { user_id: "u1", course: "Direito" }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await updateResumeEducation(VALUES);

    expect(result).toEqual({ ok: true, data: { resume: { user_id: "u1", course: "Direito" } } });
    expect(fake.calls.find((call) => call.table === "resumes" && call.operation === "update")).toMatchObject({
      payload: {
        course: "Direito",
        education_status: "cursando",
        graduation_year: 2027,
        experience_months: 6,
        suggested_roles: ["Estágio em Direito", "Estágio em Dados"],
      },
      filters: [["user_id", "u1"]],
    });
    expect(fake.calls.find((call) => call.table === "job_profiles")).toMatchObject({ payload: { last_run_at: null } });
  });

  it("recusa na demo, sem tocar no banco", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...USER, isDemo: true });
    const fake = createFakeSupabase();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    expect((await updateResumeEducation(VALUES)).ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("recusa curso fora da lista, ano inválido e quem não tem currículo", async () => {
    const fake = createFakeSupabase();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    expect((await updateResumeEducation({ ...VALUES, course: "Inventado" })).ok).toBe(false);
    expect(await updateResumeEducation({ ...VALUES, graduationYear: 27 })).toMatchObject({ error: "Informe o ano com 4 dígitos." });
    expect(fake.calls).toEqual([]);
    expect(await updateResumeEducation(VALUES)).toMatchObject({ error: "Envie o currículo antes de corrigir a formação." });
  });
});

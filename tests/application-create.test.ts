import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./support/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const { getCurrentUser } = await import("@/features/auth/session");
const { createClient } = await import("@/lib/supabase/server");
const { createApplication } = await import("@/features/applications/actions");
const { applicationFormSchema, emptyApplicationFormValues, normalizeUrl, toApplicationPayload } = await import(
  "@/features/applications/schema"
);

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "eu@email.com", name: null, avatarUrl: null, isDemo: false };

const validValues = {
  ...emptyApplicationFormValues,
  company: "  Banco Aurora ",
  roleTitle: "Estágio em Engenharia de Software",
  jobType: "estagio" as const,
  jobUrl: "gupy.io/vagas/123",
  platform: "gupy" as const,
  location: "",
  workModel: "hibrido" as const,
  salary: "R$ 2.200,50",
  appliedAt: "2026-10-10",
  stage: "enviada" as const,
  priority: "alta" as const,
  notes: "",
};

describe("validação do formulário de candidatura", () => {
  it("aceita uma candidatura válida", () => {
    expect(applicationFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("exige empresa e cargo, com mensagens em português", () => {
    const result = applicationFormSchema.safeParse({ ...validValues, company: "   ", roleTitle: "" });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((issue) => [issue.path[0], issue.message]);
    expect(messages).toContainEqual(["company", "Informe o nome da empresa."]);
    expect(messages).toContainEqual(["roleTitle", "Informe o cargo ou o nome da vaga."]);
  });

  it("recusa link, valor e data inválidos", () => {
    const result = applicationFormSchema.safeParse({
      ...validValues,
      jobUrl: "isso não é um link",
      salary: "dois mil",
      appliedAt: "2026-02-30",
    });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["jobUrl", "salary", "appliedAt"]));
  });

  it("recusa etapa e tipo de vaga que não existem", () => {
    expect(applicationFormSchema.safeParse({ ...validValues, stage: "contratada" }).success).toBe(false);
    const result = applicationFormSchema.safeParse({ ...validValues, jobType: "estagiario" });
    expect(result.error!.issues[0]).toMatchObject({ path: ["jobType"], message: "Escolha o tipo de vaga." });
  });

  it("aceita os outros tipos de vaga, além de estágio", () => {
    for (const jobType of ["trainee", "clt", "pj", "temporario", "freela"]) {
      expect(applicationFormSchema.safeParse({ ...validValues, jobType }).success).toBe(true);
    }
  });

  it("completa o link com https:// quando falta", () => {
    expect(normalizeUrl("gupy.io/vaga")).toBe("https://gupy.io/vaga");
    expect(normalizeUrl("http://site.com")).toBe("http://site.com");
    expect(normalizeUrl("  ")).toBe("");
  });

  it("converte os valores do formulário para as colunas do banco", () => {
    expect(toApplicationPayload(applicationFormSchema.parse(validValues))).toEqual({
      company: "Banco Aurora",
      role_title: "Estágio em Engenharia de Software",
      job_type: "estagio",
      job_url: "https://gupy.io/vagas/123",
      platform: "gupy",
      location: null,
      work_model: "hibrido",
      salary_cents: 220050,
      applied_at: "2026-10-10",
      stage: "enviada",
      priority: "alta",
      notes: null,
    });
  });
});

describe("createApplication (Server Action)", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
    vi.mocked(revalidatePath).mockClear();
  });

  it("grava a candidatura do usuário logado e devolve o id", async () => {
    const fake = createFakeSupabase({ "applications.insert": { data: { id: "nova-id" }, error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await createApplication(validValues);

    expect(result).toEqual({ ok: true, data: { id: "nova-id" } });
    expect(fake.calls).toHaveLength(1);
    const insert = fake.calls[0];
    expect(insert.table).toBe("applications");
    expect(insert.operation).toBe("insert");
    expect(insert.payload).toMatchObject({
      user_id: USER.id,
      company: "Banco Aurora",
      stage: "enviada",
      salary_cents: 220050,
    });
    // Candidaturas novas entram no topo da coluna (posição negativa e menor que as antigas).
    expect((insert.payload as { position: number }).position).toBeLessThan(0);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("não chama o banco quando os dados são inválidos e devolve os erros por campo", async () => {
    const fake = createFakeSupabase();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await createApplication({ ...validValues, company: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toEqual({ company: "Informe o nome da empresa." });
    }
    expect(fake.calls).toHaveLength(0);
  });

  it("pede login de novo quando a sessão expirou", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await createApplication(validValues);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("sessão expirou") });
  });

  it("traduz erros do banco em uma mensagem clara", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = createFakeSupabase({
      "applications.insert": { data: null, error: { code: "23514", message: "check constraint" } },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await createApplication(validValues);

    expect(result).toEqual({ ok: false, error: "Algum valor está fora do permitido. Revise os campos e tente de novo." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

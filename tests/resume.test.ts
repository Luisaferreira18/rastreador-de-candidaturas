import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_RESUME_FILE } from "@/features/demo/seed";
import { fold } from "@/features/job-search/text";
import { educationStatus, extractResume, findCity, findLanguages, findSkills, hasReadableText } from "@/features/resume/extract";
import { PdfError, isPdf, readPdfText } from "@/features/resume/pdf";
import { cleanFileName, parseLanguages, toResumeRow } from "@/features/resume/resume";
import { createFakeSupabase } from "./support/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { getCurrentUser } = await import("@/features/auth/session");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/curriculo/route");

const YEAR = 2026;
const demoPdf = readFileSync(DEMO_RESUME_FILE);

describe("leitura do currículo", () => {
  it("lê o PDF de exemplo inteiro", async () => {
    const text = await readPdfText(demoPdf);
    expect(extractResume(text, YEAR)).toEqual({
      skills: ["Excel", "SQL", "Python", "Power BI", "Pandas", "JavaScript", "React", "HTML", "CSS", "Git", "GitHub", "Scrum"],
      languages: [
        { name: "Inglês", level: "avancado" },
        { name: "Espanhol", level: "basico" },
      ],
      course: "Sistemas de Informação",
      educationStatus: "cursando",
      graduationYear: 2027,
      city: "São Paulo",
      state: "SP",
      roles: ["Estágio em Desenvolvimento", "Estágio em Tecnologia", "Estágio em Dados"],
      jobTypes: ["estagio", "trainee"],
    });
  });

  it("não guarda nome, e-mail nem telefone", async () => {
    const row = toResumeRow("u1", { name: "cv.pdf", size: 10 }, extractResume(await readPdfText(demoPdf), YEAR));
    const saved = JSON.stringify(row);
    expect(saved).not.toContain("Alex");
    expect(saved).not.toContain("@exemplo.com");
    expect(saved).not.toContain("90000");
  });

  it("habilidades: outros jeitos de escrever, mas só palavras inteiras", () => {
    expect(findSkills(fold("MS Excel, PostgreSQL e PowerBI"))).toEqual(["Excel", "SQL", "Power BI"]);
    expect(findSkills(fold("Sou excelente em comunicação e conheço JavaScript."))).toEqual(["JavaScript"]);
    expect(findSkills(fold("C#, .NET e C++"))).toEqual(["C#", ".NET", "C++"]);
  });

  it("idiomas com o nível, parando no próximo idioma", () => {
    expect(findLanguages(fold("Inglês: intermediário | Espanhol: fluente"))).toEqual([
      { name: "Inglês", level: "intermediario" },
      { name: "Espanhol", level: "fluente" },
    ]);
    expect(findLanguages(fold("English (B2). Curso de inglês avançado em andamento."))).toEqual([
      { name: "Inglês", level: "avancado" },
    ]);
    expect(findLanguages(fold("Letras - Português e Inglês"))).toEqual([{ name: "Inglês", level: null }]);
  });

  it("curso concluído vira vaga de entrada; o mais específico ganha", () => {
    const text = "Formação Acadêmica\nEngenharia de Produção - Universidade X\n2019 - 2025 (concluído)";
    expect(extractResume(text, YEAR)).toMatchObject({
      course: "Engenharia de Produção",
      educationStatus: "concluido",
      graduationYear: 2025,
      roles: ["Engenharia de Produção"],
      jobTypes: ["trainee", "clt"],
    });
    expect(extractResume("Formação\nAdministração, concluída em 2015", YEAR)).toMatchObject({
      roles: ["Analista de Administração"],
      jobTypes: ["clt"],
    });
  });

  it("fora da parte de formação, o curso precisa de \"graduação em\"", () => {
    expect(extractResume("Graduação em Direito, 5º semestre", YEAR)).toMatchObject({
      course: "Direito",
      educationStatus: "cursando",
      roles: ["Estágio em Direito"],
      jobTypes: ["estagio"],
    });
    expect(extractResume("Conhecimentos em direito do consumidor", YEAR).course).toBeNull();
  });

  it("situação do curso pelas datas e palavras", () => {
    expect(educationStatus(fold("2023 - atual"), YEAR)).toEqual({ status: "cursando", graduationYear: null });
    expect(educationStatus(fold("Conclusão prevista para 2026"), YEAR)).toEqual({ status: "cursando", graduationYear: 2026 });
    expect(educationStatus(fold("2018 - 2022"), YEAR)).toEqual({ status: "concluido", graduationYear: 2022 });
    expect(educationStatus("", YEAR)).toEqual({ status: null, graduationYear: null });
  });

  it("cidade só no começo, sem pegar o nome da linha de cima nem o bairro", () => {
    expect(findCity("Maria Souza\nMontes Claros - MG · (38) 90000-0000")).toEqual({ city: "Montes Claros", state: "MG" });
    expect(findCity("Rua das Flores, 10 - Centro, Campinas - SP")).toEqual({ city: "Campinas", state: "SP" });
    expect(findCity("Jo Silva · Curitiba · jo@exemplo.com")).toEqual({ city: "Curitiba", state: "PR" });
    expect(findCity("Sem cidade aqui")).toEqual({ city: null, state: null });
  });

  it("PDF escaneado não tem texto; outro arquivo não é PDF", async () => {
    expect(hasReadableText("  \n ")).toBe(false);
    expect(isPdf(new Uint8Array(demoPdf))).toBe(true);
    expect(isPdf(new TextEncoder().encode("PK\u0003\u0004 planilha"))).toBe(false);
    await expect(readPdfText(new TextEncoder().encode("%PDF-1.7 quebrado"))).rejects.toBeInstanceOf(PdfError);
  });

  it("nome do arquivo e idiomas voltam limpos do banco", () => {
    expect(cleanFileName("C:\\fakepath\\Meu currículo.pdf")).toBe("Meu currículo.pdf");
    expect(parseLanguages([{ name: "Inglês", level: "avancado" }, { name: "Alemão", level: "??" }, "x", null])).toEqual([
      { name: "Inglês", level: "avancado" },
      { name: "Alemão", level: null },
    ]);
    expect(parseLanguages(null)).toEqual([]);
  });
});

describe("POST /api/curriculo", () => {
  const USER = { id: "u1", email: "ana@exemplo.com", name: "Ana", avatarUrl: null, isDemo: false };

  function fakeClient() {
    const db = createFakeSupabase({ "resumes.upsert": { data: { user_id: "u1", skills: ["SQL"] }, error: null } });
    const upload = vi.fn(async () => ({ data: { path: "u1/curriculo.pdf" }, error: null }));
    const storage = { from: vi.fn(() => ({ upload })) };
    return { client: { ...db.client, storage }, calls: db.calls, upload, storage };
  }

  function request(file: File | null) {
    const body = new FormData();
    if (file) body.set("arquivo", file);
    return new Request("http://localhost/api/curriculo", { method: "POST", body });
  }

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("guarda o PDF na pasta da pessoa e o que foi lido, e libera uma busca nova", async () => {
    const fake = fakeClient();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const response = await POST(request(new File([demoPdf], "Meu currículo.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", resume: { user_id: "u1" } });

    expect(fake.storage.from).toHaveBeenCalledWith("curriculos");
    expect(fake.upload).toHaveBeenCalledWith("u1/curriculo.pdf", expect.any(Uint8Array), {
      contentType: "application/pdf",
      upsert: true,
    });
    const saved = fake.calls.find((call) => call.table === "resumes" && call.operation === "upsert");
    expect(saved?.payload).toMatchObject({
      user_id: "u1",
      file_path: "u1/curriculo.pdf",
      file_name: "Meu currículo.pdf",
      skills: expect.arrayContaining(["SQL", "Python"]),
    });
    const profile = fake.calls.find((call) => call.table === "job_profiles" && call.operation === "update");
    expect(profile).toMatchObject({ payload: { last_run_at: null }, filters: [["user_id", "u1"]] });
  });

  it("recusa na conta demo, sem tocar no banco", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...USER, isDemo: true });
    const fake = fakeClient();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const response = await POST(request(new File([demoPdf], "cv.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(403);
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.calls).toEqual([]);
  });

  it("recusa o que não é PDF, mesmo com o tipo certo, e arquivo vazio", async () => {
    const fake = fakeClient();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const fakePdf = await POST(request(new File(["não sou um PDF"], "cv.pdf", { type: "application/pdf" })));
    expect(fakePdf.status).toBe(415);
    expect((await POST(request(new File([], "cv.pdf")))).status).toBe(400);
    expect((await POST(request(null))).status).toBe(400);
    expect(fake.upload).not.toHaveBeenCalled();
  });

  it("sem sessão, pede para entrar de novo", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const response = await POST(request(new File([demoPdf], "cv.pdf")));
    expect(response.status).toBe(401);
  });
});

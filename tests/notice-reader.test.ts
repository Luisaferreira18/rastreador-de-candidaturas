import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeFetchError, checkNoticeUrl, editalPdfLink, fetchNoticeText, htmlToPlainText, isPrivateAddress } from "@/features/concursos/notice-fetch";
import { readingToFormValues } from "@/features/concursos/notice-form";
import { parseNotice } from "@/features/concursos/notice-parser";
import { concursoFormSchema } from "@/features/concursos/schema";

vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
const { getCurrentUser } = await import("@/features/auth/session");
const { POST } = await import("@/app/api/concursos/edital/route");

const USER = { id: "u1", email: "eu@email.com", name: null, avatarUrl: null, isDemo: false };
const TODAY = "2026-10-29";

describe("download do edital: proteção contra endereços internos", () => {
  it("reconhece endereços internos, da própria máquina e reservados", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.20.0.1", "192.168.0.10", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "200.152.38.1", "2804:14c::1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("só aceita links http(s) públicos, sem senha e nas portas padrão", () => {
    expect(checkNoticeUrl("https://www.in.gov.br/edital.pdf").hostname).toBe("www.in.gov.br");
    for (const url of [
      "ftp://site.org/edital.pdf",
      "http://localhost/edital",
      "http://127.0.0.1/edital",
      "http://[::1]/edital",
      "http://10.0.0.5/edital",
      "https://pessoa:senha@site.org/edital",
      "https://site.org:8443/edital",
      "http://metadata.google.internal/",
      "não é um link",
    ]) {
      expect(() => checkNoticeUrl(url), url).toThrow(NoticeFetchError);
    }
  });

  it("não chega a baixar nada de um endereço interno", async () => {
    await expect(fetchNoticeText("http://127.0.0.1/edital.pdf")).rejects.toThrow("não é público");
  });
});

describe("download do edital: páginas", () => {
  it("transforma a página em texto, mantendo linhas e células de tabela", () => {
    const html =
      "<html><head><script>alert(1)</script><style>p{}</style></head><body><h1>Edital nº 1</h1><table><tr><td>Prova objetiva</td><td>08/11/2026</td></tr></table><p>Inscrições &amp; isenção</p></body></html>";
    expect(htmlToPlainText(html)).toBe("Edital nº 1\nProva objetiva | 08/11/2026 |\nInscrições & isenção");
  });

  it("na página da banca, acha o PDF do edital de abertura", () => {
    const html = `<a href="/arquivos/manual.pdf">Manual do candidato</a>
      <a href="/arquivos/ed_1_abertura.pdf">Edital nº 1 - Abertura</a>
      <a href="/arquivos/ed_2_retificacao.pdf">Edital nº 2 - Retificação</a>`;
    expect(editalPdfLink(html, new URL("https://www.cebraspe.org.br/concursos/cgu_26"))).toBe(
      "https://www.cebraspe.org.br/arquivos/ed_1_abertura.pdf",
    );
    expect(editalPdfLink('<a href="guia.pdf">Guia</a>', new URL("https://site.org/"))).toBeNull();
    // Visualizador do Diário Oficial: o PDF vem num quadro.
    const viewer = '<frameset><frame name="visualizador" src="../../servlet/INPDFViewer?jornal=530&amp;pagina=155&amp;data=09/10/2026" /></frameset>';
    expect(editalPdfLink(viewer, new URL("https://pesquisa.in.gov.br/imprensa/jsp/visualiza/index.jsp"))).toBe(
      "https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?jornal=530&pagina=155&data=09/10/2026",
    );
  });
});

describe("do edital para o formulário", () => {
  it("preenche o formulário com o cargo escolhido e o cronograma, e o resultado é válido", () => {
    const reading = parseNotice(readFileSync("tests/fixtures/editais/trt8.txt", "utf8"), "2026-10-28");
    const values = readingToFormValues(reading, {
      role: reading.roles[3],
      education: "superior",
      sourceUrl: "https://www.trt8.jus.br/edital.pdf",
      today: TODAY,
    });
    expect(values).toMatchObject({
      organ: "Tribunal Regional do Trabalho da 8ª Região",
      roleTitle: "Analista Judiciário - Área Apoio Especializado - Especialidade Tecnologia da Informação",
      examBoard: "FCC",
      salary: "16.040,88",
      reserveList: true,
      stage: "edital_publicado",
      noticeUrl: "https://www.trt8.jus.br/edital.pdf",
      registrationUrl: "https://www.concursosfcc.com.br",
    });
    expect(values.notes).toContain("Taxa de inscrição: R$");
    expect(values.dates).toEqual([
      { kind: "inscricao_inicio", date: "2026-10-05", time: "10:00", note: "" },
      { kind: "inscricao_fim", date: "2026-11-05", time: "23:59", note: "" },
      { kind: "boleto", date: "2026-11-06", time: "22:00", note: "" },
    ]);
    expect(concursoFormSchema.safeParse(values).success).toBe(true);
  });
});

describe("POST /api/concursos/edital", () => {
  const post = (body: unknown) =>
    POST(new Request("http://localhost/api/concursos/edital", { method: "POST", body: JSON.stringify(body) }));

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("lê o texto colado e devolve as sugestões, sem salvar nada", async () => {
    const response = await post({ text: readFileSync("tests/fixtures/editais/cgu.txt", "utf8") });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      reading: { organ: "Controladoria-Geral da União", examBoard: "Cebraspe" },
      source: { url: null, isPdf: false },
    });
    expect(body.educationByRole).toEqual(["superior", "superior", "superior", "superior"]);
  });

  it("recusa texto curto demais, link interno e quem não está logado", async () => {
    expect((await post({ text: "Edital" })).status).toBe(400);
    const internal = await post({ url: "http://localhost/edital.pdf" });
    expect(internal.status).toBe(422);
    expect((await internal.json()).message).toContain("não é público");
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await post({ text: "x".repeat(300) })).status).toBe(401);
  });
});

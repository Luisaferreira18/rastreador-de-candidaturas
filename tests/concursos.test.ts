import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { groupByStage, moveCard } from "@/features/board/board-state";
import { DEFAULT_CONCURSO_FILTERS, filterAndSortConcursos } from "@/features/concursos/list-filters";
import {
  daysUntil,
  examCountdown,
  examCountdownLabel,
  formatTime,
  isUrgent,
  nextDate,
  registrationLabel,
  registrationStatus,
  sortSchedule,
} from "@/features/concursos/schedule";
import {
  concursoFormSchema,
  emptyConcursoFormValues,
  toConcursoFormValues,
  toConcursoPayload,
  toDateRows,
  toSubjectRows,
} from "@/features/concursos/schema";
import { nextSubjectStatus, subjectProgress } from "@/features/concursos/subjects";
import type { ConcursoSummary, ScheduleDate } from "@/features/concursos/types";
import { CONCURSO_STAGE_KEYS, CONCURSO_STAGES } from "@/lib/concurso-stages";
import { createFakeSupabase } from "./support/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { getCurrentUser } = await import("@/features/auth/session");
const { createClient } = await import("@/lib/supabase/server");
const { createConcurso, moveConcurso, setSubjectStatus, undoMoveConcurso, updateConcurso } = await import(
  "@/features/concursos/actions"
);

const TODAY = "2026-10-29";
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "eu@email.com", name: null, avatarUrl: null, isDemo: false };
const CONCURSO_ID = "6a1f0c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

const date = (kind: ScheduleDate["kind"], day: string, time: string | null = null): ScheduleDate => ({ kind, date: day, time });

describe("etapas dos concursos", () => {
  it("são as mesmas travadas no banco, na mesma ordem", () => {
    const sql = readFileSync("supabase/migrations/20261029000000_concursos.sql", "utf8");
    const check = /stage in \(([\s\S]*?)\)\)/.exec(sql)![1];
    const keys = [...check.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(keys).toEqual([...CONCURSO_STAGE_KEYS]);
  });

  it("falam da etapa, não da pessoa", () => {
    const labels = CONCURSO_STAGES.map((stage) => stage.label);
    expect(labels).toContain("Inscrição feita");
    expect(labels).not.toContain("Inscrita");
    expect(labels).not.toContain("Aprovada");
  });

  it("o quadro genérico monta uma coluna por etapa de concurso", () => {
    const cards = [
      { id: "a", stage: "prova_marcada" as const, position: 10 },
      { id: "b", stage: "acompanhando" as const, position: 0 },
    ];
    const columns = groupByStage(cards, CONCURSO_STAGE_KEYS);
    expect(Object.keys(columns)).toEqual([...CONCURSO_STAGE_KEYS]);
    expect(columns.prova_marcada.map((card) => card.id)).toEqual(["a"]);
    const moved = moveCard(columns, "b", "inscricao_feita", 0);
    expect(moved.inscricao_feita[0]).toMatchObject({ id: "b", stage: "inscricao_feita" });
    expect(moved.acompanhando).toEqual([]);
  });
});

describe("cronograma e contagem até a prova", () => {
  it("conta os dias até a data (0 = hoje, negativo = passou)", () => {
    expect(daysUntil("2026-11-08", TODAY)).toBe(10);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
    expect(daysUntil("2026-10-27", TODAY)).toBe(-2);
    // Atravessa o fim do horário de verão sem errar o dia.
    expect(daysUntil("2027-03-01", "2027-02-01")).toBe(28);
  });

  it("usa a próxima prova; se todas passaram, a última", () => {
    const dates = [date("prova", "2026-12-06", "08:00:00"), date("prova", "2026-12-13"), date("inscricao_fim", "2026-11-10")];
    expect(examCountdown(dates, TODAY)).toEqual({ status: "futura", days: 38, date: "2026-12-06", time: "08:00:00" });
    expect(examCountdown(dates, "2026-12-06")).toMatchObject({ status: "hoje", days: 0 });
    expect(examCountdown(dates, "2026-12-10")).toMatchObject({ status: "futura", days: 3, date: "2026-12-13" });
    expect(examCountdown(dates, "2026-12-20")).toMatchObject({ status: "passou", days: 7, date: "2026-12-13" });
    expect(examCountdown([date("inscricao_fim", "2026-11-10")], TODAY)).toBeNull();
  });

  it("escreve a contagem como as pessoas falam", () => {
    expect(examCountdownLabel({ status: "futura", days: 23, date: "x", time: null })).toBe("Prova em 23 dias");
    expect(examCountdownLabel({ status: "futura", days: 1, date: "x", time: null })).toBe("Prova amanhã");
    expect(examCountdownLabel({ status: "hoje", days: 0, date: "x", time: null })).toBe("Prova hoje");
    expect(examCountdownLabel({ status: "passou", days: 3, date: "x", time: null })).toBe("Prova foi há 3 dias");
  });

  it("sabe se as inscrições estão abertas, para abrir ou encerradas (e vale a prorrogação)", () => {
    const dates = [date("inscricao_inicio", "2026-11-03"), date("inscricao_fim", "2026-11-20")];
    expect(registrationStatus(dates, TODAY)).toEqual({ status: "em-breve", opensIn: 5, start: "2026-11-03", end: "2026-11-20" });
    expect(registrationStatus(dates, "2026-11-17")).toEqual({ status: "abertas", closesIn: 3, end: "2026-11-20" });
    expect(registrationStatus(dates, "2026-11-21")).toEqual({ status: "encerradas", end: "2026-11-20" });
    const extended = [...dates, date("inscricao_fim", "2026-11-27")];
    expect(registrationStatus(extended, "2026-11-21")).toMatchObject({ status: "abertas", closesIn: 6 });
    expect(registrationStatus([], TODAY)).toEqual({ status: "sem-data" });
    expect(registrationLabel(registrationStatus(dates, "2026-11-17"))).toBe("Inscrições até 20/11 (em 3 dias)");
    expect(registrationLabel(registrationStatus(dates, "2026-11-20"))).toBe("Inscrições terminam hoje");
  });

  it("destaca inscrição, isenção e boleto vencendo em até 7 dias", () => {
    expect(isUrgent(date("boleto", "2026-11-05"), TODAY)).toBe(true);
    expect(isUrgent(date("inscricao_fim", "2026-11-06"), TODAY)).toBe(false);
    expect(isUrgent(date("prova", "2026-10-30"), TODAY)).toBe(false);
    expect(isUrgent(date("boleto", "2026-10-28"), TODAY)).toBe(false);
  });

  it("ordena por data, hora e a ordem natural das etapas", () => {
    const sorted = sortSchedule([
      date("prova", "2026-12-06", "14:00:00"),
      date("inscricao_fim", "2026-11-10"),
      date("prova", "2026-12-06", "08:00:00"),
      date("inscricao_inicio", "2026-11-10"),
    ]);
    expect(sorted.map((item) => `${item.kind} ${item.time ?? ""}`.trim())).toEqual([
      "inscricao_inicio",
      "inscricao_fim",
      "prova 08:00:00",
      "prova 14:00:00",
    ]);
    expect(nextDate(sorted, "2026-11-11")?.kind).toBe("prova");
    expect(nextDate(sorted, TODAY, ["prova"])?.time).toBe("08:00:00");
    expect(formatTime("08:30:00")).toBe("08:30");
  });
});

describe("progresso das matérias", () => {
  const subject = (status: "nao_estudado" | "estudado" | "revisado", weight: number | null = null, questions: number | null = null) => ({
    status,
    weight,
    questions,
  });

  it("conta pelo peso, depois pelas questões, e 1 sem os dois", () => {
    const progress = subjectProgress([
      subject("revisado", 2),
      subject("estudado", null, 30),
      subject("nao_estudado", null, 10),
      subject("nao_estudado"),
    ]);
    // pesos: 2 + 30 + 10 + 1 = 43; estudado = 32; revisado = 2
    expect(progress).toEqual({ total: 4, studied: 2, reviewed: 1, studiedPercent: 74, reviewedPercent: 5 });
  });

  it("sem matérias, o progresso é zero", () => {
    expect(subjectProgress([])).toEqual({ total: 0, studied: 0, reviewed: 0, studiedPercent: 0, reviewedPercent: 0 });
  });

  it("o clique passa por não estudado → estudado → revisado → não estudado", () => {
    expect(nextSubjectStatus("nao_estudado")).toBe("estudado");
    expect(nextSubjectStatus("estudado")).toBe("revisado");
    expect(nextSubjectStatus("revisado")).toBe("nao_estudado");
  });
});

describe("formulário do concurso", () => {
  const values = {
    ...emptyConcursoFormValues,
    organ: "  Tribunal Regional do Trabalho da 3ª Região ",
    roleTitle: "Analista Judiciário - TI",
    examBoard: "FCC",
    salary: "13.994,78",
    vacancies: "12",
    reserveList: true,
    city: "Belo Horizonte",
    state: "MG" as const,
    noticeUrl: "trt3.jus.br/edital.pdf",
    dates: [
      { kind: "prova" as const, date: "2026-12-06", time: "08:00", note: "" },
      { kind: "inscricao_fim" as const, date: "2026-11-10", time: "", note: "Até 18h" },
      { kind: "prova" as const, date: "2026-12-06", time: "08:00", note: "repetida" },
    ],
    subjects: [
      { id: "s-existente", name: "Português", weight: "1,5", questions: "", status: "revisado" as const },
      { id: "nova-1", name: "Banco de dados", weight: "", questions: "20", status: "nao_estudado" as const },
    ],
  };

  it("valida e converte para as colunas do banco", () => {
    expect(concursoFormSchema.safeParse(values).success).toBe(true);
    expect(toConcursoPayload(values)).toMatchObject({
      organ: "Tribunal Regional do Trabalho da 3ª Região",
      salary_cents: 1_399_478,
      vacancies: 12,
      reserve_list: true,
      state: "MG",
      notice_url: "https://trt3.jus.br/edital.pdf",
      registration_url: null,
      exam_board: "FCC",
      area: null,
    });
  });

  it("recusa data, hora e números inválidos, sem perder as outras mensagens", () => {
    const result = concursoFormSchema.safeParse({
      ...values,
      organ: "",
      vacancies: "doze",
      dates: [{ kind: "prova", date: "2026-02-30", time: "25:00", note: "" }],
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["organ", "vacancies", "dates.0.date", "dates.0.time"]));
  });

  it("cronograma: em ordem e sem repetir a mesma data do mesmo tipo", () => {
    const rows = toDateRows(CONCURSO_ID, USER.id, values.dates);
    expect(rows.map((row) => [row.kind, row.date, row.time, row.note])).toEqual([
      ["inscricao_fim", "2026-11-10", null, "Até 18h"],
      ["prova", "2026-12-06", "08:00", null],
    ]);
  });

  it("matérias: as que já existiam mantêm o id (e o que foi estudado); as novas ganham um id", () => {
    const rows = toSubjectRows(CONCURSO_ID, USER.id, values.subjects, new Set(["s-existente"]), () => "novo-uuid");
    expect(rows).toEqual([
      expect.objectContaining({ id: "s-existente", name: "Português", weight: 1.5, status: "revisado", position: 0 }),
      expect.objectContaining({ id: "novo-uuid", questions: 20, weight: null, position: 1 }),
    ]);
  });

  it("volta do banco para o formulário (hora sem segundos, peso com vírgula)", () => {
    const form = toConcursoFormValues(
      { ...toConcursoPayload(values), id: CONCURSO_ID, user_id: USER.id, position: 0, stage_changed_at: "", created_at: "", updated_at: "" } as never,
      [{ id: "d1", concurso_id: CONCURSO_ID, user_id: USER.id, kind: "prova", date: "2026-12-06", time: "08:00:00", note: null, created_at: "" }],
      [{ id: "s1", concurso_id: CONCURSO_ID, user_id: USER.id, name: "Português", weight: 1.5, questions: null, status: "estudado", position: 0, created_at: "" }],
    );
    expect(form).toMatchObject({
      salary: "13.994,78",
      vacancies: "12",
      dates: [{ kind: "prova", date: "2026-12-06", time: "08:00", note: "" }],
      subjects: [{ id: "s1", name: "Português", weight: "1,5", questions: "", status: "estudado" }],
    });
  });
});

describe("ações no servidor", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("moveConcurso salva a etapa e a posição, filtrando pelo dono", async () => {
    const fake = createFakeSupabase({
      "concursos.update": { data: { id: CONCURSO_ID, stage: "taxa_paga", position: 512, stage_changed_at: "x" }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await moveConcurso({ id: CONCURSO_ID, stage: "taxa_paga", position: 512 });
    expect(result.ok).toBe(true);
    expect(fake.calls[0]).toMatchObject({
      table: "concursos",
      operation: "update",
      payload: { stage: "taxa_paga", position: 512 },
      filters: [
        ["id", CONCURSO_ID],
        ["user_id", USER.id],
      ],
    });
  });

  it("moveConcurso sem posição vai para o topo; etapa de candidatura é recusada sem tocar no banco", async () => {
    const fake = createFakeSupabase({ "concursos.update": { data: { id: CONCURSO_ID }, error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    await moveConcurso({ id: CONCURSO_ID, stage: "prova_feita" });
    expect((fake.calls[0].payload as { position: number }).position).toBeLessThan(0);

    const before = fake.calls.length;
    const result = await moveConcurso({ id: CONCURSO_ID, stage: "entrevista_rh" as never });
    expect(result).toEqual({ ok: false, error: "Não foi possível mover: dados inválidos." });
    expect(fake.calls.length).toBe(before);
  });

  it("moveConcurso avisa quando o concurso não existe (ou é de outra pessoa)", async () => {
    vi.mocked(createClient).mockResolvedValue(createFakeSupabase().client as never);
    const result = await moveConcurso({ id: CONCURSO_ID, stage: "taxa_paga" });
    expect(result).toEqual({ ok: false, error: "Não encontramos esse concurso. Ele pode ter sido excluído." });
  });

  it("desfazer volta a etapa e apaga do histórico o engano e o retorno", async () => {
    const fake = createFakeSupabase({ "concursos.update": { data: { id: CONCURSO_ID }, error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await undoMoveConcurso({
      id: CONCURSO_ID,
      movedTo: "taxa_paga",
      movedAt: "2026-10-29T12:00:00.000Z",
      previousStage: "inscricao_feita",
      previousPosition: 100,
      previousStageChangedAt: "2026-10-20T09:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(fake.calls[0]).toMatchObject({
      payload: { stage: "inscricao_feita", position: 100, stage_changed_at: "2026-10-20T09:00:00.000Z" },
      filters: expect.arrayContaining([["stage", "taxa_paga"]]),
    });
    const deletes = fake.calls.filter((call) => call.table === "concurso_stage_history" && call.operation === "delete");
    expect(deletes).toHaveLength(2);
  });

  it("editar: mudou de etapa → topo da coluna; matérias removidas são apagadas e ids de fora viram matéria nova", async () => {
    const fake = createFakeSupabase({
      "concursos.select": { data: { stage: "acompanhando" }, error: null },
      "concursos.update": { data: { id: CONCURSO_ID }, error: null },
      "concurso_subjects.select": { data: [{ id: "s-existente" }, { id: "s-removida" }], error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await updateConcurso(CONCURSO_ID, {
      ...emptyConcursoFormValues,
      organ: "IBGE",
      roleTitle: "Analista",
      stage: "inscricao_feita",
      subjects: [
        { id: "s-existente", name: "Estatística", weight: "", questions: "", status: "estudado" },
        { id: "id-de-outra-pessoa", name: "Geografia", weight: "", questions: "", status: "revisado" },
      ],
    });
    expect(result.ok).toBe(true);

    const update = fake.calls.find((call) => call.table === "concursos" && call.operation === "update")!;
    expect((update.payload as { position: number }).position).toBeLessThan(0);

    const removed = fake.calls.find((call) => call.table === "concurso_subjects" && call.operation === "delete")!;
    expect(removed.filters).toContainEqual(["id not in", "(s-existente)"]);
    const saved = fake.calls.find((call) => call.table === "concurso_subjects" && call.operation === "upsert")!;
    const rows = saved.payload as { id: string; name: string }[];
    expect(rows[0].id).toBe("s-existente");
    expect(rows[1].id).not.toBe("id-de-outra-pessoa");
    expect(rows[1].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("criar: se o cronograma não salvar, o concurso é desfeito", async () => {
    const fake = createFakeSupabase({
      "concursos.insert": { data: { id: CONCURSO_ID }, error: null },
      "concurso_dates.insert": { data: null, error: { code: "23514", message: "check" } },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    const result = await createConcurso({
      ...emptyConcursoFormValues,
      organ: "IBGE",
      roleTitle: "Analista",
      dates: [{ kind: "prova", date: "2026-12-06", time: "", note: "" }],
    });
    expect(result.ok).toBe(false);
    expect(fake.calls.some((call) => call.table === "concursos" && call.operation === "delete")).toBe(true);
  });

  it("marcar matéria: só status válido, filtrando pelo dono", async () => {
    const fake = createFakeSupabase({ "concurso_subjects.update": { data: [{ id: CONCURSO_ID }], error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);
    expect((await setSubjectStatus({ id: CONCURSO_ID, status: "revisado" })).ok).toBe(true);
    expect(fake.calls[0]).toMatchObject({ payload: { status: "revisado" }, filters: expect.arrayContaining([["user_id", USER.id]]) });
    expect((await setSubjectStatus({ id: CONCURSO_ID, status: "decorado" })).ok).toBe(false);
  });
});

describe("lista de concursos", () => {
  const base = {
    user_id: USER.id,
    exam_board: null,
    area: null,
    salary_cents: null,
    vacancies: null,
    reserve_list: false,
    city: null,
    state: null,
    notice_url: null,
    registration_url: null,
    notes: null,
    priority: "media",
    position: 0,
    stage_changed_at: "",
    created_at: "",
    updated_at: "2026-10-01T00:00:00Z",
    progress: subjectProgress([]),
    pendingTasks: 0,
    nextDueDate: null,
  } as const;
  const concursos: ConcursoSummary[] = [
    { ...base, id: "1", organ: "TRT 3ª Região", role_title: "Analista de TI", sphere: "federal", education: "superior", stage: "inscricao_feita", exam_board: "FCC", city: "Belo Horizonte", state: "MG", dates: [date("prova", "2026-12-06")] },
    { ...base, id: "2", organ: "Prefeitura de Contagem", role_title: "Técnico", sphere: "municipal", education: "medio", stage: "acompanhando", city: "Contagem", state: "MG", dates: [date("prova", "2026-11-15")] },
    { ...base, id: "3", organ: "IBGE", role_title: "Recenseador", sphere: "federal", education: "medio", stage: "acompanhando", exam_board: "FGV", dates: [] },
  ];

  it("filtra por esfera, banca, local e busca sem acento", () => {
    const filter = (patch: Partial<typeof DEFAULT_CONCURSO_FILTERS>) =>
      filterAndSortConcursos(concursos, { ...DEFAULT_CONCURSO_FILTERS, ...patch }, TODAY).map((item) => item.id);
    expect(filter({ sphere: "municipal" })).toEqual(["2"]);
    expect(filter({ examBoard: "fgv" })).toEqual(["3"]);
    expect(filter({ place: "MG" }).sort()).toEqual(["1", "2"]);
    expect(filter({ place: "Belo Horizonte/MG" })).toEqual(["1"]);
    expect(filter({ q: "tecnico" })).toEqual(["2"]);
  });

  it("ordena pela prova mais próxima; sem prova vai para o fim", () => {
    const sorted = filterAndSortConcursos(concursos, { ...DEFAULT_CONCURSO_FILTERS, sort: "prova", direction: "asc" }, TODAY);
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });
});

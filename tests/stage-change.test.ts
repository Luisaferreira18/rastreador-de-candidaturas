import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  groupByStage,
  moveCard,
  placeCard,
  positionBetween,
  positionForIndex,
} from "@/features/board/board-state";
import { emptyApplicationFormValues } from "@/features/applications/schema";
import { createFakeSupabase } from "./support/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { getCurrentUser } = await import("@/features/auth/session");
const { createClient } = await import("@/lib/supabase/server");
const { moveApplication, undoMoveApplication, updateApplication } = await import("@/features/applications/actions");

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "eu@email.com", name: null, avatarUrl: null, isDemo: false };
const APP_ID = "3f2c1a9e-8b7d-4c6e-9f1a-2b3c4d5e6f70";

describe("moveApplication (mudança de etapa)", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("salva a nova etapa e a posição, filtrando pelo dono", async () => {
    const fake = createFakeSupabase({
      "applications.update": { data: { id: APP_ID, stage: "entrevista_rh", position: 512 }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await moveApplication({ id: APP_ID, stage: "entrevista_rh", position: 512 });

    expect(result).toEqual({ ok: true, data: { id: APP_ID, stage: "entrevista_rh", position: 512 } });
    expect(fake.calls[0]).toMatchObject({
      table: "applications",
      operation: "update",
      payload: { stage: "entrevista_rh", position: 512 },
      filters: [
        ["id", APP_ID],
        ["user_id", USER.id],
      ],
    });
  });

  it("sem posição informada, coloca a candidatura no topo da coluna", async () => {
    const fake = createFakeSupabase({
      "applications.update": { data: { id: APP_ID, stage: "proposta", position: -1 }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    await moveApplication({ id: APP_ID, stage: "proposta" });

    const payload = fake.calls[0].payload as { position: number };
    expect(payload.position).toBeLessThan(0);
  });

  it("recusa etapa inválida sem tocar no banco", async () => {
    const fake = createFakeSupabase();
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await moveApplication({ id: APP_ID, stage: "contratada" as never });

    expect(result.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("avisa quando a candidatura não existe (ou é de outra pessoa)", async () => {
    const fake = createFakeSupabase({ "applications.update": { data: null, error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await moveApplication({ id: APP_ID, stage: "aprovada" });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("Não encontramos essa candidatura") });
  });
});

describe("undoMoveApplication (desfazer)", () => {
  const input = {
    id: APP_ID,
    movedTo: "proposta" as const,
    movedAt: "2026-10-19T23:00:00.123456+00:00",
    previousStage: "entrevista_tecnica" as const,
    previousPosition: 2048,
    previousStageChangedAt: "2026-10-15T13:05:00+00:00",
  };

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("volta etapa, posição e data, só se a etapa ainda for a do engano", async () => {
    const fake = createFakeSupabase({
      "applications.update": { data: { id: APP_ID }, error: null },
      "stage_history.delete": { data: null, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await undoMoveApplication(input);

    expect(result.ok).toBe(true);
    const update = fake.calls.find((call) => call.operation === "update")!;
    expect(update.payload).toEqual({
      stage: "entrevista_tecnica",
      position: 2048,
      stage_changed_at: "2026-10-15T13:05:00+00:00",
    });
    expect(update.filters).toContainEqual(["stage", "proposta"]);
  });

  it("apaga do histórico o movimento por engano e o registro de volta", async () => {
    const fake = createFakeSupabase({
      "applications.update": { data: { id: APP_ID }, error: null },
      "stage_history.delete": { data: null, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    await undoMoveApplication(input);

    const deletes = fake.calls.filter((call) => call.table === "stage_history" && call.operation === "delete");
    expect(deletes).toHaveLength(2);
    expect(deletes[0].filters).toEqual(
      expect.arrayContaining([
        ["from_stage", "entrevista_tecnica"],
        ["to_stage", "proposta"],
        ["changed_at>=", input.movedAt],
      ]),
    );
    expect(deletes[1].filters).toEqual(
      expect.arrayContaining([
        ["from_stage", "proposta"],
        ["to_stage", "entrevista_tecnica"],
        ["changed_at", input.previousStageChangedAt],
      ]),
    );
  });

  it("não desfaz se a candidatura já mudou de etapa de novo", async () => {
    const fake = createFakeSupabase({ "applications.update": { data: null, error: null } });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    const result = await undoMoveApplication(input);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("não dá mais para desfazer") });
    expect(fake.calls.some((call) => call.table === "stage_history")).toBe(false);
  });
});

describe("updateApplication: etapa alterada pelo formulário", () => {
  const values = { ...emptyApplicationFormValues, company: "Lumen Saúde", roleTitle: "Estágio em Produto" };

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(USER);
  });

  it("quando a etapa muda, manda o card para o topo da nova coluna", async () => {
    const fake = createFakeSupabase({
      "applications.select": { data: { stage: "enviada" }, error: null },
      "applications.update": { data: { id: APP_ID }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    await updateApplication(APP_ID, { ...values, stage: "entrevista_rh" });

    const update = fake.calls.find((call) => call.operation === "update")!;
    expect(update.payload).toMatchObject({ stage: "entrevista_rh" });
    expect((update.payload as { position?: number }).position).toBeLessThan(0);
  });

  it("quando a etapa não muda, mantém a posição do card", async () => {
    const fake = createFakeSupabase({
      "applications.select": { data: { stage: "quero_candidatar" }, error: null },
      "applications.update": { data: { id: APP_ID }, error: null },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    await updateApplication(APP_ID, values);

    const update = fake.calls.find((call) => call.operation === "update")!;
    expect(update.payload).not.toHaveProperty("position");
  });
});

describe("lógica do quadro Kanban", () => {
  const cards = [
    { id: "a", stage: "enviada" as const, position: 0 },
    { id: "b", stage: "enviada" as const, position: 1024 },
    { id: "c", stage: "teste_online" as const, position: 0 },
  ];

  it("agrupa por etapa e ordena pela posição", () => {
    const columns = groupByStage([cards[1], cards[2], cards[0]]);
    expect(columns.enviada.map((card) => card.id)).toEqual(["a", "b"]);
    expect(columns.teste_online.map((card) => card.id)).toEqual(["c"]);
    expect(columns.proposta).toEqual([]);
  });

  it("move um card para outra coluna na posição indicada, sem alterar o original", () => {
    const columns = groupByStage(cards);
    const moved = moveCard(columns, "b", "teste_online", 0);
    expect(moved.enviada.map((card) => card.id)).toEqual(["a"]);
    expect(moved.teste_online.map((card) => card.id)).toEqual(["b", "c"]);
    expect(moved.teste_online[0].stage).toBe("teste_online");
    expect(columns.enviada).toHaveLength(2);
  });

  it("calcula a posição entre os vizinhos", () => {
    expect(positionBetween(0, 1024)).toBe(512);
    expect(positionBetween(undefined, 0)).toBe(-1024);
    expect(positionBetween(1024, undefined)).toBe(2048);
    expect(positionBetween()).toBe(0);

    const moved = moveCard(groupByStage(cards), "c", "enviada", 1);
    expect(positionForIndex(moved.enviada, "c")).toBe(512);
  });

  it("coloca o card na posição certa ao desfazer um movimento", () => {
    const columns = groupByStage(cards);
    const placed = placeCard(columns, "c", "enviada", 500);
    expect(placed.enviada.map((card) => card.id)).toEqual(["a", "c", "b"]);
    expect(placed.teste_online).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeDashboardMetrics,
  maxFunnelOrder,
  startOfWeekISO,
  weeklyApplications,
  type MetricsApplication,
  type MetricsHistoryEntry,
} from "@/features/dashboard/metrics";
import type { StageKey } from "@/lib/stages";

function app(id: string, stage: StageKey, extra: Partial<MetricsApplication> = {}): MetricsApplication {
  return { id, stage, platform: "linkedin", applied_at: stage === "quero_candidatar" ? null : "2026-10-01", ...extra };
}

function path(id: string, stages: StageKey[]): MetricsHistoryEntry[] {
  return stages.map((to_stage) => ({ application_id: id, to_stage }));
}

describe("maxFunnelOrder: etapa mais avançada alcançada", () => {
  it("usa a etapa mais alta do histórico, mesmo depois de uma reprovação", () => {
    expect(maxFunnelOrder(app("1", "reprovada"), ["enviada", "teste_online", "entrevista_rh", "reprovada"])).toBe(4);
  });

  it("considera a etapa atual quando não há histórico", () => {
    expect(maxFunnelOrder(app("1", "entrevista_tecnica"), [])).toBe(5);
  });

  it("reprovada ou com data de candidatura conta como enviada", () => {
    expect(maxFunnelOrder(app("1", "reprovada", { applied_at: null }), [])).toBe(1);
    expect(maxFunnelOrder(app("1", "desisti", { applied_at: "2026-09-01" }), ["desisti"])).toBe(1);
  });

  it("desistir antes de se candidatar não conta como enviada", () => {
    expect(maxFunnelOrder(app("1", "desisti", { applied_at: null }), ["quero_candidatar", "desisti"])).toBe(0);
  });
});

describe("computeDashboardMetrics", () => {
  const applications = [
    app("wish", "quero_candidatar", { platform: "gupy" }),
    app("sent", "enviada", { platform: "gupy" }),
    app("test", "teste_online", { platform: "linkedin" }),
    app("rh-rejected", "reprovada", { platform: "linkedin" }),
    app("skip", "entrevista_tecnica", { platform: "indicacao" }),
    app("approved", "aprovada", { platform: "gupy" }),
    app("ghosted-quit", "desisti", { platform: "outra" }),
  ];
  const history = [
    ...path("wish", ["quero_candidatar"]),
    ...path("sent", ["enviada"]),
    ...path("test", ["enviada", "teste_online"]),
    ...path("rh-rejected", ["enviada", "teste_online", "entrevista_rh", "reprovada"]),
    // Pulou o teste e a dinâmica: foi direto para as entrevistas.
    ...path("skip", ["enviada", "entrevista_rh", "entrevista_tecnica"]),
    ...path("approved", ["enviada", "entrevista_rh", "entrevista_tecnica", "proposta", "aprovada"]),
    ...path("ghosted-quit", ["enviada", "desisti"]),
  ];
  const metrics = computeDashboardMetrics(applications, history);

  it("conta totais, em andamento e lista de desejos", () => {
    expect(metrics.total).toBe(7);
    expect(metrics.wishlist).toBe(1);
    expect(metrics.active).toBe(3); // enviada, teste online, entrevista técnica
    expect(metrics.closed).toBe(3); // aprovada, reprovada, desisti
  });

  it("calcula a taxa de resposta sobre as candidaturas enviadas", () => {
    expect(metrics.sent).toBe(6);
    // Responderam: test, rh-rejected, skip, approved. Sem resposta: sent, ghosted-quit.
    expect(metrics.responded).toBe(4);
    expect(metrics.responseRate).toBeCloseTo(4 / 6);
  });

  it("monta o funil contando quem chegou à etapa ou além", () => {
    const counts = Object.fromEntries(metrics.funnel.map((step) => [step.stage, step.count]));
    expect(counts).toEqual({
      enviada: 6,
      teste_online: 4, // test, rh-rejected, skip (pulou), approved
      dinamica_case: 3,
      entrevista_rh: 3,
      entrevista_tecnica: 2,
      proposta: 1,
      aprovada: 1,
    });
  });

  it("calcula a aprovação de uma etapa para a seguinte", () => {
    const first = metrics.conversion[0];
    expect(first).toMatchObject({ from: "enviada", to: "teste_online", reached: 6, advanced: 4 });
    expect(first.rate).toBeCloseTo(4 / 6);
    const last = metrics.conversion.at(-1)!;
    expect(last).toMatchObject({ from: "proposta", to: "aprovada", rate: 1 });
    expect(metrics.approvalRate).toBeCloseTo(1 / 6);
  });

  it("agrupa por plataforma, da maior para a menor", () => {
    expect(metrics.byPlatform.map((item) => [item.platform, item.count])).toEqual([
      ["gupy", 3],
      ["linkedin", 2],
      ["indicacao", 1],
      ["outra", 1],
    ]);
  });

  it("não divide por zero quando não há nada", () => {
    const empty = computeDashboardMetrics([], []);
    expect(empty.total).toBe(0);
    expect(empty.responseRate).toBeNull();
    expect(empty.approvalRate).toBeNull();
    expect(empty.conversion.every((step) => step.rate === null)).toBe(true);
    expect(empty.byPlatform).toEqual([]);
  });
});

describe("weeklyApplications", () => {
  it("começa a semana na segunda-feira", () => {
    expect(startOfWeekISO("2026-10-19")).toBe("2026-10-19"); // segunda
    expect(startOfWeekISO("2026-10-25")).toBe("2026-10-19"); // domingo
    expect(startOfWeekISO("2026-10-01")).toBe("2026-09-28"); // quinta
  });

  it("conta as candidaturas enviadas em cada semana", () => {
    const points = weeklyApplications(
      [
        { applied_at: "2026-10-20" },
        { applied_at: "2026-10-19" },
        { applied_at: "2026-10-13" },
        { applied_at: "2026-01-01" }, // fora da janela
        { applied_at: null },
      ],
      "2026-10-21",
      4,
    );
    expect(points.map((point) => [point.label, point.count])).toEqual([
      ["28/09", 0],
      ["05/10", 0],
      ["12/10", 1],
      ["19/10", 2],
    ]);
  });
});

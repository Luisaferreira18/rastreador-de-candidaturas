import { describe, expect, it } from "vitest";
import { buildSampleData } from "@/features/demo/sample-data";
import {
  DEFAULT_FILTERS,
  filterAndSortApplications,
  parseListFilters,
  serializeListFilters,
} from "@/features/applications/list-filters";
import type { ApplicationSummary } from "@/features/applications/types";
import { STAGE_KEYS } from "@/lib/stages";

function summary(partial: Partial<ApplicationSummary> & { id: string; company: string }): ApplicationSummary {
  return {
    user_id: "u",
    role_title: "Estágio",
    job_type: "estagio",
    job_url: null,
    platform: "linkedin",
    location: null,
    work_model: "hibrido",
    salary_cents: null,
    applied_at: null,
    stage: "enviada",
    priority: "media",
    notes: null,
    position: 0,
    stage_changed_at: "2026-10-01T12:00:00Z",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    pendingTasks: 0,
    nextDueDate: null,
    ...partial,
  };
}

describe("filtros da lista", () => {
  const rows = [
    summary({ id: "1", company: "Lumen Saúde", stage: "proposta", priority: "alta", salary_cents: 200000 }),
    summary({ id: "2", company: "Banco Aurora", platform: "gupy", salary_cents: 220000, updated_at: "2026-10-10T00:00:00Z" }),
    summary({ id: "3", company: "Atlas Seguros", priority: "baixa", work_model: "presencial", location: "São Paulo", job_type: "clt" }),
  ];

  it("busca sem diferenciar acentos e maiúsculas", () => {
    const result = filterAndSortApplications(rows, { ...DEFAULT_FILTERS, q: "SAUDE" });
    expect(result.map((row) => row.id)).toEqual(["1"]);
    const byLocation = filterAndSortApplications(rows, { ...DEFAULT_FILTERS, q: "sao paulo" });
    expect(byLocation.map((row) => row.id)).toEqual(["3"]);
  });

  it("combina filtros e ordena", () => {
    expect(filterAndSortApplications(rows, { ...DEFAULT_FILTERS, platform: "gupy" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterAndSortApplications(rows, { ...DEFAULT_FILTERS, jobType: "clt" }).map((r) => r.id)).toEqual(["3"]);
    expect(
      filterAndSortApplications(rows, { ...DEFAULT_FILTERS, sort: "remuneracao", direction: "desc" }).map((r) => r.id),
    ).toEqual(["2", "1", "3"]);
    expect(
      filterAndSortApplications(rows, { ...DEFAULT_FILTERS, sort: "prioridade", direction: "asc" }).map((r) => r.id),
    ).toEqual(["1", "2", "3"]);
  });

  it("lê e escreve os filtros na URL, ignorando valores inválidos", () => {
    const filters = parseListFilters(
      new URLSearchParams("q=dados&etapa=proposta&tipo=clt&plataforma=orkut&ordem=remuneracao&dir=asc"),
    );
    expect(filters).toMatchObject({
      q: "dados",
      stage: "proposta",
      jobType: "clt",
      platform: null,
      sort: "remuneracao",
      direction: "asc",
    });
    expect(serializeListFilters(filters)).toBe("q=dados&etapa=proposta&tipo=clt&ordem=remuneracao&dir=asc");
    expect(parseListFilters(new URLSearchParams("tipo=estagiario")).jobType).toBeNull();
    expect(serializeListFilters(DEFAULT_FILTERS)).toBe("");
  });
});

describe("dados de exemplo", () => {
  let counter = 0;
  const plan = buildSampleData("user-1", "2026-10-19", () => `id-${++counter}`);

  it("gera candidaturas em várias etapas, todas do mesmo usuário", () => {
    expect(plan.applications.length).toBeGreaterThanOrEqual(15);
    expect(new Set(plan.applications.map((a) => a.stage)).size).toBe(STAGE_KEYS.length);
    expect(plan.applications.every((a) => a.user_id === "user-1")).toBe(true);
    // A demonstração mostra vários tipos de vaga, não só estágio.
    expect(new Set(plan.applications.map((a) => a.job_type)).size).toBeGreaterThanOrEqual(4);
  });

  it("monta uma linha do tempo coerente para cada candidatura", () => {
    for (const application of plan.applications) {
      const entries = plan.history.filter((entry) => entry.application_id === application.id);
      expect(entries[0].from_stage).toBeNull();
      expect(entries.at(-1)!.to_stage).toBe(application.stage);
      expect(entries.at(-1)!.changed_at).toBe(application.stage_changed_at);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].from_stage).toBe(entries[i - 1].to_stage);
        expect(entries[i].changed_at! > entries[i - 1].changed_at!).toBe(true);
      }
    }
  });

  it("usa a data de 'enviada' como data da candidatura e liga as tarefas a candidaturas existentes", () => {
    const ids = new Set(plan.applications.map((a) => a.id));
    expect(plan.tasks.every((task) => task.application_id && ids.has(task.application_id))).toBe(true);
    const aurora = plan.applications.find((a) => a.company === "Banco Aurora")!;
    expect(aurora.applied_at).toBe("2026-09-21"); // enviada há 28 dias
  });
});

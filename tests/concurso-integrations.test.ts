import { describe, expect, it } from "vitest";
import { concursoAgenda, concursoDeadlines, isDatePending, type AgendaConcurso } from "@/features/concursos/agenda";
import { buildConcursoCalendar, calendarFileName, escapeIcsText, foldIcsLine } from "@/features/concursos/calendar";
import { buildConcursosCsv } from "@/features/concursos/export";
import { toConcursoSearchProfile } from "@/features/concursos/search/profile";
import { MIN_CONCURSO_SCORE, scoreNotice } from "@/features/concursos/search/score";
import { buildSampleConcursos, DEMO_CONCURSO_PROFILE, sampleNotices } from "@/features/demo/sample-concursos";
import { clearUserData, seedDemoConcursoSearch } from "@/features/demo/seed";
import { CONCURSO_STAGE_KEYS } from "@/lib/concurso-stages";
import type { Tables } from "@/types/database";
import { createFakeSupabase } from "./support/fake-supabase";

const TODAY = "2026-10-29";

const concurso = (overrides: Partial<AgendaConcurso> = {}): AgendaConcurso => ({
  id: "c1",
  organ: "Agência Nacional de Dados",
  role_title: "Analista de TI",
  stage: "edital_publicado",
  dates: [],
  ...overrides,
});

describe("agenda dos concursos", () => {
  it("só alerta o que ainda falta fazer na etapa atual", () => {
    expect(isDatePending("inscricao_fim", "edital_publicado")).toBe(true);
    expect(isDatePending("inscricao_fim", "inscricao_feita")).toBe(false);
    expect(isDatePending("boleto", "inscricao_feita")).toBe(true);
    expect(isDatePending("boleto", "taxa_paga")).toBe(false);
    expect(isDatePending("prova", "taxa_paga")).toBe(true);
    // Concurso encerrado não tem agenda.
    expect(isDatePending("resultado", "desisti")).toBe(false);
    expect(isDatePending("validade", "nomeacao")).toBe(false);
  });

  it("separa alertas de inscrição, isenção e boleto (7 dias) das próximas datas (30 dias)", () => {
    const agenda = concursoAgenda(
      [
        concurso({
          dates: [
            { kind: "inscricao_inicio", date: "2026-10-20", time: null },
            { kind: "inscricao_fim", date: "2026-11-01", time: "23:59:00" },
            { kind: "boleto", date: "2026-11-02", time: null },
            { kind: "prova", date: "2026-11-23", time: "08:00:00" },
            { kind: "resultado", date: "2027-01-10", time: null },
          ],
        }),
        concurso({
          id: "c2",
          organ: "Câmara de Serra Clara",
          stage: "taxa_paga",
          dates: [
            { kind: "boleto", date: "2026-10-30", time: null },
            { kind: "prova", date: "2026-11-05", time: null },
          ],
        }),
      ],
      TODAY,
    );
    expect(agenda.alerts.map((item) => [item.organ, item.kind, item.days, item.time])).toEqual([
      ["Agência Nacional de Dados", "inscricao_fim", 3, "23:59"],
      ["Agência Nacional de Dados", "boleto", 4, null],
    ]);
    expect(agenda.upcoming.map((item) => [item.organ, item.kind, item.days])).toEqual([
      ["Câmara de Serra Clara", "prova", 7],
      ["Agência Nacional de Dados", "prova", 25],
    ]);
  });

  it("prazos da semana juntam alertas e outras datas, por data", () => {
    const items = concursoDeadlines(
      [
        concurso({
          dates: [
            { kind: "prova", date: "2026-10-31", time: null },
            { kind: "inscricao_fim", date: "2026-11-03", time: null },
            { kind: "gabarito", date: "2026-11-20", time: null },
          ],
        }),
      ],
      TODAY,
    );
    expect(items.map((item) => item.kind)).toEqual(["prova", "inscricao_fim"]);
  });
});

describe("cronograma em .ics", () => {
  const items = [
    {
      concurso: {
        id: "c1",
        organ: "Agência Nacional de Dados",
        role_title: "Analista em Tecnologia da Informação, Banco de Dados",
        notice_url: "https://example.com/edital.pdf",
        registration_url: "https://example.com/inscricao",
      },
      dates: [
        { id: "d1", kind: "prova" as const, date: "2026-11-23", time: "08:00:00", note: "Objetiva; discursiva à tarde" },
        { id: "d2", kind: "inscricao_fim" as const, date: "2026-11-01", time: null, note: null },
        { id: "d3", kind: "resultado" as const, date: "2027-01-10", time: null, note: null },
      ],
    },
  ];
  const ics = buildConcursoCalendar(items, { appUrl: "https://rastreador.app", now: new Date("2026-10-29T15:04:05.123Z") });
  const unfolded = ics.replace(/\r\n /g, "");

  it("escapa o texto e quebra linhas longas sem cortar acentos", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    const line = `SUMMARY:${"Língua Portuguesa e Raciocínio ".repeat(5)}`;
    const folded = foldIcsLine(line);
    expect(folded.split("\r\n ").join("")).toBe(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
  });

  it("monta um calendário válido com fuso de Brasília, dia inteiro e lembretes", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(unfolded).toContain("TZID:America/Sao_Paulo");
    expect(unfolded).toContain("DTSTART;TZID=America/Sao_Paulo:20261123T080000\r\nDURATION:PT4H");
    expect(unfolded).toContain("DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102");
    expect(unfolded).toContain("DTSTAMP:20261029T150405Z");
    expect(unfolded).toContain("UID:concurso-data-d1@rastreador-de-candidaturas");
    expect(unfolded).toContain(
      "SUMMARY:Prova: Agência Nacional de Dados (Analista em Tecnologia da Informação\\, Banco de Dados)",
    );
    expect(unfolded).toContain("DESCRIPTION:Objetiva\\; discursiva à tarde\\nInscrição (só no site oficial): https://example.com/inscricao");
    expect(unfolded).toContain("URL:https://rastreador.app/concursos/c1");
    // Lembrete para a prova e o fim das inscrições; o resultado não tem.
    expect(unfolded.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(unfolded).toContain("TRIGGER:-P1D");
    expect(unfolded).toContain("TRIGGER:-PT15H");
  });

  it("dá nome ao arquivo", () => {
    expect(calendarFileName({ organ: "TRT-8", role_title: "Analista Judiciário" })).toBe("concurso-trt-8-analista-judiciario.ics");
    expect(calendarFileName()).toBe("concursos.ics");
  });
});

describe("CSV dos concursos", () => {
  it("uma linha por concurso, com cronograma, matérias, tarefas e linha do tempo", () => {
    const base = {
      user_id: "u1",
      exam_board: "Cebraspe",
      sphere: "federal",
      education: "superior",
      area: "TI",
      salary_cents: 1050000,
      vacancies: 30,
      reserve_list: true,
      city: "Brasília",
      state: "DF",
      notice_url: "https://example.com/edital.pdf",
      registration_url: null,
      notes: "=cuidado",
      priority: "alta",
      position: 0,
      stage_changed_at: "2026-10-20T13:00:00Z",
      created_at: "2026-10-01T13:00:00Z",
      updated_at: "2026-10-20T13:00:00Z",
    } as const;
    const csv = buildConcursosCsv({
      concursos: [{ ...base, id: "c1", organ: "Agência; Dados", role_title: "Analista", stage: "taxa_paga" } as Tables<"concursos">],
      dates: [
        { id: "d1", concurso_id: "c1", user_id: "u1", kind: "prova", date: "2026-11-23", time: "08:00:00", note: null, created_at: "" },
        { id: "d2", concurso_id: "c1", user_id: "u1", kind: "inscricao_fim", date: "2026-11-01", time: null, note: "prorrogado", created_at: "" },
      ],
      subjects: [
        { id: "s1", concurso_id: "c1", user_id: "u1", name: "Banco de Dados", weight: 2, questions: 20, status: "estudado", position: 0, created_at: "" },
        { id: "s2", concurso_id: "c1", user_id: "u1", name: "Português", weight: null, questions: 20, status: "nao_estudado", position: 1024, created_at: "" },
      ] as Tables<"concurso_subjects">[],
      history: [
        { id: "h1", concurso_id: "c1", user_id: "u1", from_stage: null, to_stage: "acompanhando", changed_at: "2026-10-01T13:00:00Z" },
        { id: "h2", concurso_id: "c1", user_id: "u1", from_stage: "acompanhando", to_stage: "taxa_paga", changed_at: "2026-10-20T13:00:00Z" },
      ],
      tasks: [
        { id: "t1", application_id: null, concurso_id: "c1", user_id: "u1", title: "Simulado", due_date: "2026-11-05", done: false, completed_at: null, created_at: "" },
        { id: "t2", application_id: "a1", concurso_id: null, user_id: "u1", title: "De outra candidatura", due_date: null, done: false, completed_at: null, created_at: "" },
      ],
    });
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith("Órgão;Cargo;Banca;Esfera;Escolaridade")).toBe(true);
    const row = lines[1];
    expect(row.startsWith('"Agência; Dados";Analista;Cebraspe;Federal;Ensino superior;TI;10.500,00;30;Sim;Brasília;DF;Taxa paga;Alta;')).toBe(true);
    expect(row).toContain("Fim das inscrições: 01/11/2026 (prorrogado) | Prova: 23/11/2026 08:00");
    expect(row).toContain("Banco de Dados (peso 2, 20 questões, estudado) | Português (20 questões, não estudado)");
    expect(row).toContain("9% estudado, 0% revisado");
    expect(row).toContain("Simulado (até 05/11/2026)");
    expect(row).not.toContain("De outra candidatura");
    expect(row).toContain("Acompanhando em");
    // Injeção de fórmula neutralizada.
    expect(row).toContain(";'=cuidado;");
  });
});

describe("concursos de exemplo da demo", () => {
  let counter = 0;
  const plan = buildSampleConcursos("demo", TODAY, () => `id-${++counter}`);

  it("cobre várias etapas, com linha do tempo coerente e tudo ligado ao concurso certo", () => {
    expect(plan.concursos.length).toBeGreaterThanOrEqual(5);
    expect(new Set(plan.concursos.map((item) => item.stage)).size).toBeGreaterThanOrEqual(5);
    expect(plan.concursos.every((item) => CONCURSO_STAGE_KEYS.includes(item.stage!))).toBe(true);
    const ids = new Set(plan.concursos.map((item) => item.id));
    for (const rows of [plan.history, plan.dates, plan.subjects, plan.tasks]) {
      expect(rows.every((row) => ids.has(row.concurso_id!) && row.user_id === "demo")).toBe(true);
    }
    for (const item of plan.concursos) {
      const entries = plan.history.filter((entry) => entry.concurso_id === item.id);
      expect(entries[0].from_stage).toBeNull();
      expect(entries.at(-1)!.to_stage).toBe(item.stage);
      expect(entries.at(-1)!.changed_at).toBe(item.stage_changed_at);
    }
    // Os links são de exemplo: a demo nunca leva a uma inscrição de verdade.
    expect(plan.concursos.every((item) => item.notice_url?.startsWith("https://example.com/"))).toBe(true);
  });

  it("mostra alertas de inscrição e boleto e uma prova com contagem no painel", () => {
    const agenda = concursoAgenda(
      plan.concursos.map((item) => ({
        id: item.id,
        organ: item.organ,
        role_title: item.role_title,
        stage: item.stage!,
        dates: plan.dates.filter((date) => date.concurso_id === item.id).map((date) => ({ kind: date.kind, date: date.date, time: date.time ?? null })),
      })),
      TODAY,
    );
    expect(agenda.alerts.map((item) => item.kind)).toEqual(["inscricao_fim", "boleto"]);
    expect(agenda.upcoming.some((item) => item.kind === "prova")).toBe(true);
  });

  it("os editais de exemplo viram sugestões para o perfil da demo", () => {
    const profile = toConcursoSearchProfile(DEMO_CONCURSO_PROFILE);
    const notices = sampleNotices(TODAY);
    expect(notices.every((notice) => notice.source === "exemplo")).toBe(true);
    const matches = notices.map((notice) => scoreNotice(notice, profile, TODAY));
    for (const match of matches) {
      expect(match.excluded).toBe(false);
      if (!match.excluded) expect(match.score).toBeGreaterThanOrEqual(MIN_CONCURSO_SCORE);
    }
  });

  it("o seed grava os editais de exemplo com o cliente administrativo e as sugestões da pessoa", async () => {
    const notices = sampleNotices(TODAY).map((notice, index) => ({
      id: `n${index}`,
      source: notice.source,
      external_id: notice.externalId,
      organ: notice.organ,
      title: notice.title,
      roles: notice.roles,
      exam_board: notice.examBoard,
      sphere: notice.sphere,
      salary_cents: notice.salaryCents,
      vacancies: notice.vacancies,
      reserve_list: notice.reserveList,
      city: notice.city,
      state: notice.state,
      notice_url: notice.noticeUrl,
      registration_url: notice.registrationUrl,
      published_at: notice.publishedAt,
      dates: notice.dates,
      excerpt: notice.excerpt,
      found_at: `${TODAY}T12:00:00Z`,
    }));
    const user = createFakeSupabase({ "concurso_notices.select": { data: notices, error: null } });
    const admin = createFakeSupabase();
    const result = await seedDemoConcursoSearch(user.client as never, "demo", { catalog: admin.client as never, today: TODAY });

    const catalog = admin.calls.find((call) => call.table === "concurso_notices");
    expect(catalog?.operation).toBe("upsert");
    expect((catalog?.payload as { source: string }[]).every((row) => row.source === "exemplo")).toBe(true);
    expect(user.calls.find((call) => call.table === "concurso_profiles")?.payload).toMatchObject({ user_id: "demo", auto_search: true });
    const leads = user.calls.find((call) => call.table === "concurso_leads");
    expect(leads?.operation).toBe("upsert");
    expect(leads?.payload).toHaveLength(3);
    expect(result.leads).toBe(3);
    // A conta comum nunca grava no catálogo.
    expect(user.calls.some((call) => call.table === "concurso_notices" && call.operation !== "select")).toBe(false);
  });

  it("o reset apaga concursos, sugestões e perfil de concursos também", async () => {
    const fake = createFakeSupabase();
    await clearUserData(fake.client as never, "demo");
    const deleted = fake.calls.filter((call) => call.operation === "delete").map((call) => call.table);
    expect(deleted).toEqual(
      expect.arrayContaining(["concursos", "concurso_leads", "concurso_profiles", "applications", "job_leads"]),
    );
  });
});

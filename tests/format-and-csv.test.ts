import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "@/lib/csv";
import {
  addDaysISO,
  diffDaysISO,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
  formatRelativeDay,
  isValidISODate,
  parseBRLToCents,
  todayISO,
} from "@/lib/format";
import { groupUpcomingTasks } from "@/features/tasks/upcoming";

// Intl usa espaço não separável depois do "R$"; normalizamos para comparar.
const plain = (text: string) => text.replace(/ /g, " ");

describe("formatação no padrão brasileiro", () => {
  it("formata datas e valores", () => {
    expect(formatDate("2026-10-19")).toBe("19/10/2026");
    expect(plain(formatCurrency(180050))).toBe("R$ 1.800,50");
    expect(plain(formatCurrencyCompact(220000))).toBe("R$ 2.200");
    expect(formatDate(null)).toBe("—");
  });

  it("mostra horários no fuso de São Paulo, independente do servidor", () => {
    expect(formatDateTime("2026-10-19T13:30:00Z")).toBe("19/10/2026, 10:30");
  });

  it("calcula 'hoje' no fuso de São Paulo", () => {
    // 01h UTC do dia 20 ainda é dia 19 em São Paulo.
    expect(todayISO(new Date("2026-10-20T01:00:00Z"))).toBe("2026-10-19");
  });

  it("descreve dias relativos", () => {
    expect(formatRelativeDay("2026-10-19", "2026-10-19")).toBe("hoje");
    expect(formatRelativeDay("2026-10-20", "2026-10-19")).toBe("amanhã");
    expect(formatRelativeDay("2026-10-16", "2026-10-19")).toBe("há 3 dias");
  });

  it("lê valores digitados em reais", () => {
    expect(parseBRLToCents("1800")).toBe(180000);
    expect(parseBRLToCents("1.800")).toBe(180000);
    expect(parseBRLToCents("1.800,5")).toBe(180050);
    expect(parseBRLToCents("R$ 2.200,00")).toBe(220000);
    expect(parseBRLToCents("1800.50")).toBe(180050);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("-10")).toBeNull();
  });

  it("faz contas com datas sem erro de fuso", () => {
    expect(addDaysISO("2026-02-28", 1)).toBe("2026-03-01");
    expect(diffDaysISO("2026-10-01", "2026-10-19")).toBe(18);
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
  });
});

describe("CSV", () => {
  it("usa ; e escapa aspas, quebras de linha e o separador", () => {
    expect(escapeCsvField('Diz "olá"; tchau')).toBe('"Diz ""olá""; tchau"');
    expect(escapeCsvField("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
    expect(escapeCsvField(null)).toBe("");
  });

  it("neutraliza fórmulas (injeção de CSV)", () => {
    expect(escapeCsvField("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(escapeCsvField("+55 11 9999")).toBe("'+55 11 9999");
  });

  it("começa com BOM para o Excel reconhecer os acentos", () => {
    const csv = toCsv(["Empresa", "Etapa"], [["Lumen Saúde", "Proposta"]]);
    expect(csv.startsWith("﻿Empresa;Etapa\r\n")).toBe(true);
    expect(csv).toContain("Lumen Saúde;Proposta");
  });
});

describe("próximos prazos", () => {
  const task = (id: string, due_date: string | null, done = false) => ({ id, title: id, due_date, done });

  it("separa atrasadas, de hoje e dos próximos 7 dias", () => {
    const groups = groupUpcomingTasks(
      [
        task("semana-que-vem", "2026-10-26"),
        task("atrasada", "2026-10-17"),
        task("hoje", "2026-10-19"),
        task("longe", "2026-10-27"),
        task("feita", "2026-10-18", true),
        task("sem-data", null),
        task("amanha", "2026-10-20"),
      ],
      "2026-10-19",
    );
    expect(groups.overdue.map((t) => t.id)).toEqual(["atrasada"]);
    expect(groups.today.map((t) => t.id)).toEqual(["hoje"]);
    expect(groups.soon.map((t) => t.id)).toEqual(["amanha", "semana-que-vem"]);
  });
});

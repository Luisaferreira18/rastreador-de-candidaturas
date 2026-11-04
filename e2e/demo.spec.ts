import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/** Entra pela página inicial, como um visitante. */
async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explorar a demonstração" }).first().click();
  await page.waitForURL("**/painel");
  await expect(page.getByRole("heading", { name: "Painel", exact: true })).toBeVisible();
}

const column = (page: Page, stage: string) => page.locator(`section[aria-label^="${stage}:"]`).first();

test("entra pela demonstração", async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByText("conta de demonstração", { exact: true })).toBeVisible();
  await expect(page.getByText("Candidaturas", { exact: true })).toBeVisible();

  // Quem já entrou não vê mais a página inicial.
  await page.goto("/");
  await expect(page).toHaveURL(/\/painel$/);
});

test("cria uma candidatura", async ({ page }) => {
  await enterDemo(page);
  const company = `Empresa E2E ${Date.now()}`;

  await page.goto("/candidaturas/nova");
  await page.getByLabel("Empresa").fill(company);
  await page.getByLabel("Cargo").fill("Estágio em Testes");
  await page.getByRole("button", { name: "Criar candidatura" }).click();

  await page.waitForURL(/\/candidaturas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: company })).toBeVisible();

  // Continua lá depois de recarregar: foi mesmo para o banco.
  await page.goto("/lista");
  await expect(page.getByRole("link", { name: new RegExp(company) }).first()).toBeVisible();
});

test("move um card no Kanban", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/quadro");
  await page.waitForLoadState("networkidle");

  const source = column(page, "Candidatura enviada");
  const target = column(page, "Teste online");
  const card = source.locator("li").first();
  const name = await card.locator("a[aria-label]").first().getAttribute("aria-label");
  expect(name).toBeTruthy();

  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Card ou coluna fora da tela.");

  const start = { x: from.x + from.width / 2, y: from.y + 20 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 25 });
  await page.mouse.up();

  const moved = target.locator("li").filter({ has: page.locator(`a[aria-label="${name}"]`) });
  await expect(moved).toBeVisible();
  await expect(page.getByText(/→ Teste online/)).toBeVisible();

  // A mudança foi salva: depois de recarregar, o card segue na coluna nova.
  await expect(async () => {
    await page.reload();
    await expect(moved).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
});

test("exporta o CSV", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/lista");

  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toMatch(/^candidaturas-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), "utf8");
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  expect(lines[0].startsWith("Empresa;Cargo;")).toBe(true);
  expect(lines.length).toBeGreaterThanOrEqual(20);
  expect(csv).toContain("Banco Aurora");
});

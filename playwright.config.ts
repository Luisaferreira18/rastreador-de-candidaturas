import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * Os testes escrevem no banco e recriam a conta demo, então só rodam contra um
 * Supabase na própria máquina. Rode com `npm run test:e2e`, que pega as chaves
 * do Supabase local: um `.env.local` apontando para produção nunca chega aqui.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(supabaseUrl)) {
  throw new Error(`Os testes de ponta a ponta só rodam com o Supabase local (recebi "${supabaseUrl}"). Use: npm run test:e2e`);
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Todos os testes usam a mesma conta demo, um de cada vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Compila aqui mesmo: o endereço do Supabase fica embutido no código do navegador.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 5 * 60 * 1000,
    stdout: "pipe",
    env: { NEXT_PUBLIC_SITE_URL: BASE_URL },
  },
});

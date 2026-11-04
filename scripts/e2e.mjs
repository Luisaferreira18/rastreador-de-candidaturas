/**
 * Roda os testes de ponta a ponta contra o Supabase local.
 *
 * Uso: npx supabase start   (uma vez, precisa do Docker)
 *      npm run test:e2e
 *
 * As chaves vêm de `supabase status`, nunca do .env.local. Argumentos extras
 * vão para o Playwright (ex.: npm run test:e2e -- --headed).
 */
import { execSync, spawnSync } from "node:child_process";

function supabaseStatus() {
  for (const command of ["supabase status -o json", "npx --yes supabase status -o json"]) {
    try {
      return JSON.parse(execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    } catch {
      // Tenta o próximo jeito de chamar a CLI.
    }
  }
  console.error("O Supabase local não respondeu. Rode `npx supabase start` primeiro (precisa do Docker).");
  process.exit(1);
}

const status = supabaseStatus();

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  // Conta só do banco local: pode ficar aqui.
  DEMO_EMAIL: "demo@rastreador.app",
  DEMO_PASSWORD: "senha-da-demo-nos-testes",
};

const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], { stdio: "inherit", env, shell: true });
process.exit(result.status ?? 1);

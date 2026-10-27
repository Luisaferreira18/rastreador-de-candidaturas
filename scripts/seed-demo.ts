/**
 * Cria (ou recria) a conta de demonstração com os dados de exemplo.
 *
 * Uso: npm run seed:demo
 * Lê NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, DEMO_EMAIL e DEMO_PASSWORD do .env.local.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { resetDemoAccount } = await import("@/features/demo/seed");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { getDemoCredentials } = await import("@/lib/env");

  const credentials = getDemoCredentials();
  if (!credentials) {
    throw new Error("Defina DEMO_EMAIL e DEMO_PASSWORD no .env.local antes de rodar o seed.");
  }

  console.log(`Preparando a conta demo (${credentials.email})...`);
  const result = await resetDemoAccount(createAdminClient(), credentials.email, credentials.password);
  console.log(`Pronto: ${result.applications} candidaturas e ${result.tasks} tarefas criadas.`);
}

main().catch((error) => {
  console.error("\nFalha ao preparar a conta demo:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

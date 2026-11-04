import { execSync } from "node:child_process";

/** Recria a conta demo no Supabase local antes dos testes (o playwright.config.ts já recusou qualquer outro banco). */
export default function globalSetup() {
  execSync("npm run seed:demo", { stdio: "inherit", env: process.env });
}

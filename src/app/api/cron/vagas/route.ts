import { NextResponse, type NextRequest } from "next/server";
import { AUTO_INTERVAL_MS, claimSearch, runSearchForUser } from "@/features/job-search/run";
import type { JobCache } from "@/features/job-search/search";
import { createAdminClient } from "@/lib/supabase/admin";

/** Passa por vários perfis; o plano grátis da Vercel permite até 300 segundos. */
export const maxDuration = 300;
/** Para de começar perfis novos com folga antes do limite. */
const TIME_BUDGET_MS = 240_000;

/**
 * GET /api/cron/vagas: chamado pelo Cron da Vercel uma vez por dia (veja
 * vercel.json). Busca vagas para todos os perfis com busca automática ligada.
 * Quem não foi atendido hoje (tempo esgotado) fica para a próxima execução ou
 * para quando abrir o app.
 *
 * Precisa da SUPABASE_SECRET_KEY: roda sem sessão, para todos os usuários.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY não configurada." }, { status: 500 });
  }

  const started = Date.now();
  const cutoff = new Date(started - AUTO_INTERVAL_MS).toISOString();
  const { data: profiles, error } = await admin
    .from("job_profiles")
    .select("user_id")
    .eq("auto_search", true)
    .or(`last_run_at.is.null,last_run_at.lt."${cutoff}"`)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) {
    console.error("[cron/vagas]", error);
    return NextResponse.json({ error: "Falha ao ler os perfis." }, { status: 500 });
  }

  // As mesmas páginas de empresas servem para todos: baixa uma vez só.
  const cache: JobCache = new Map();
  let searched = 0;
  let added = 0;
  let failed = 0;
  for (const { user_id: userId } of profiles ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      const claimed = await claimSearch(admin, userId, AUTO_INTERVAL_MS);
      if (!claimed) continue;
      const stats = await runSearchForUser(admin, userId, claimed, { cache });
      searched++;
      added += stats.added;
    } catch (searchError) {
      failed++;
      console.error("[cron/vagas] perfil", userId, searchError);
    }
  }

  return NextResponse.json({
    ok: true,
    perfis: searched,
    pendentes: (profiles?.length ?? 0) - searched - failed,
    falhas: failed,
    vagasNovas: added,
  });
}

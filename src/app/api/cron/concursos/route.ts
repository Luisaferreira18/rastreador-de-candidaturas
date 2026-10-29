import { NextResponse, type NextRequest } from "next/server";
import { AUTO_INTERVAL_MS, claimConcursoSearch, refreshCatalog, scoreForUser } from "@/features/concursos/search/run";
import { createAdminClient } from "@/lib/supabase/admin";

/** Ler o Diário Oficial do dia e passar por todos os perfis; o plano grátis permite até 300 segundos. */
export const maxDuration = 300;
/** Para de começar perfis novos com folga antes do limite. */
const TIME_BUDGET_MS = 240_000;

/**
 * GET /api/cron/concursos: chamado pelo Cron da Vercel uma vez por dia (veja
 * vercel.json). Atualiza o catálogo compartilhado (DOU e os diários das
 * cidades de todos os perfis) uma vez só e depois dá a nota para cada perfil
 * com a busca automática ligada.
 *
 * Precisa da SUPABASE_SECRET_KEY e do CRON_SECRET, como os outros crons.
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
  const { data: profiles, error } = await admin
    .from("concurso_profiles")
    .select("user_id, cities")
    .eq("auto_search", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) {
    console.error("[cron/concursos]", error);
    return NextResponse.json({ error: "Falha ao ler os perfis." }, { status: 500 });
  }

  const places = [...new Set((profiles ?? []).flatMap((profile) => profile.cities))];
  let refreshed: Awaited<ReturnType<typeof refreshCatalog>>;
  try {
    refreshed = await refreshCatalog(admin, { places });
  } catch (refreshError) {
    console.error("[cron/concursos] catálogo", refreshError);
    return NextResponse.json({ error: "Falha ao atualizar o catálogo." }, { status: 500 });
  }

  let searched = 0;
  let added = 0;
  let failed = 0;
  for (const { user_id: userId } of profiles ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      const claimed = await claimConcursoSearch(admin, userId, AUTO_INTERVAL_MS);
      if (!claimed) continue;
      const coverage = refreshed.coverage.filter((item) => claimed.cities.includes(item.place));
      const stats = await scoreForUser(admin, userId, claimed, { errors: refreshed.errors, coverage, catalogUpdated: true });
      searched++;
      added += stats.added;
    } catch (searchError) {
      failed++;
      console.error("[cron/concursos] perfil", userId, searchError);
    }
  }

  return NextResponse.json({ ok: true, catalog: refreshed.added, errors: refreshed.errors, searched, added, failed });
}

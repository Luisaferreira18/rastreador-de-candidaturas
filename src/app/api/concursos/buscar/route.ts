import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import {
  AUTO_INTERVAL_MS,
  MANUAL_INTERVAL_MS,
  claimConcursoSearch,
  refreshCatalog,
  scoreForUser,
} from "@/features/concursos/search/run";
import type { ConcursoSearchResponse } from "@/features/concursos/search/types";
import { friendlyDbError } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** O arquivo do Diário Oficial é grande: ler e filtrar leva alguns segundos. */
export const maxDuration = 120;

const reply = (body: ConcursoSearchResponse, status = 200) => NextResponse.json(body, { status });

/**
 * POST /api/concursos/buscar: busca concursos para quem está logado.
 *   { force: false } ao abrir a página: só roda se a última busca foi há mais de 20 horas.
 *   { force: true }  botão "Buscar agora": no máximo uma vez a cada 2 minutos.
 *
 * Com a chave secreta configurada, atualiza o catálogo compartilhado antes
 * (diários das cidades da pessoa e, no máximo a cada 6 horas, o DOU). Sem
 * ela, dá a nota com o que o cron já trouxe.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply({ status: "erro", message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

  const body = (await request.json().catch(() => null)) as { force?: unknown } | null;
  const force = body?.force === true;

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase.from("concurso_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!profile) return reply({ status: "sem-perfil" });
    if (!force && !profile.auto_search) return reply({ status: "desligada" });

    const claimed = await claimConcursoSearch(supabase, user.id, force ? MANUAL_INTERVAL_MS : AUTO_INTERVAL_MS);
    if (!claimed) return reply({ status: "recente" });

    let refreshed: Awaited<ReturnType<typeof refreshCatalog>> | null = null;
    try {
      refreshed = await refreshCatalog(createAdminClient(), { places: claimed.cities });
    } catch (refreshError) {
      // Sem a chave secreta (ou com o banco recusando), segue só com a nota.
      console.warn("[concursos/buscar] catálogo não atualizado:", refreshError instanceof Error ? refreshError.message : refreshError);
    }

    const stats = await scoreForUser(supabase, user.id, claimed, {
      errors: refreshed?.errors ?? [],
      coverage: refreshed?.coverage ?? [],
      catalogUpdated: refreshed !== null,
    });
    revalidateApp();
    return reply({ status: "ok", stats });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[concursos/buscar]", error);
    return reply(
      { status: "erro", message: friendlyDbError(error, "Não foi possível buscar concursos agora. Tente de novo em instantes.") },
      500,
    );
  }
}

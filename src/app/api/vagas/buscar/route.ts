import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { AUTO_INTERVAL_MS, MANUAL_INTERVAL_MS, claimSearch, runSearchForUser } from "@/features/job-search/run";
import type { SearchResponse } from "@/features/job-search/types";
import { friendlyDbError } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

/** Baixar as fontes leva alguns segundos. */
export const maxDuration = 60;

const reply = (body: SearchResponse, status = 200) => NextResponse.json(body, { status });

/**
 * POST /api/vagas/buscar: busca vagas para quem está logado.
 *   { force: false } ao abrir o app: só roda se a última busca foi há mais de 20 horas.
 *   { force: true }  botão "Buscar agora": no máximo uma vez a cada 2 minutos.
 *
 * É uma rota (e não uma Server Action) porque leva alguns segundos: as Server
 * Actions rodam em fila, e a busca seguraria os cliques da pessoa no app.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return reply({ status: "erro", message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

  const body = (await request.json().catch(() => null)) as { force?: unknown } | null;
  const force = body?.force === true;

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase.from("job_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!profile) return reply({ status: "sem-perfil" });
    if (!force && !profile.auto_search) return reply({ status: "desligada" });

    const claimed = await claimSearch(supabase, user.id, force ? MANUAL_INTERVAL_MS : AUTO_INTERVAL_MS);
    if (!claimed) return reply({ status: "recente" });

    const stats = await runSearchForUser(supabase, user.id, claimed);
    revalidateApp();
    return reply({ status: "ok", stats });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[vagas/buscar]", error);
    return reply(
      { status: "erro", message: friendlyDbError(error, "Não foi possível buscar vagas agora. Tente de novo em instantes.") },
      500,
    );
  }
}

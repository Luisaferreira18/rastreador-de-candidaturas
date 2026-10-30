"use server";

import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clearUserData,
  seedDemoConcursoSearch,
  seedDemoJobProfile,
  seedSampleConcursos,
  seedSampleData,
} from "./seed";

/** Carrega os dados de exemplo na conta de quem está logado (botão do estado vazio). */
export async function loadSampleData(): Promise<ActionResult<{ applications: number }>> {
  const user = await getCurrentUser();
  if (!user) return failure("Sua sessão expirou. Entre novamente para continuar.");

  try {
    const supabase = await createClient();
    const result = await seedSampleData(supabase, user.id);
    revalidateApp();
    return success({ applications: result.applications });
  } catch (error) {
    unstable_rethrow(error);
    return failure(friendlyDbError(error, "Não foi possível carregar os dados de exemplo."));
  }
}

/** Carrega concursos de exemplo na conta de quem está logado (botão do estado vazio dos concursos). */
export async function loadSampleConcursos(): Promise<ActionResult<{ concursos: number }>> {
  const user = await getCurrentUser();
  if (!user) return failure("Sua sessão expirou. Entre novamente para continuar.");

  try {
    const supabase = await createClient();
    const result = await seedSampleConcursos(supabase, user.id);
    revalidateApp();
    return success({ concursos: result.concursos });
  } catch (error) {
    unstable_rethrow(error);
    return failure(friendlyDbError(error, "Não foi possível carregar os concursos de exemplo."));
  }
}

/** Restaura os dados originais da conta de demonstração. */
export async function resetDemoData(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return failure("Sua sessão expirou. Entre novamente para continuar.");
  if (!user.isDemo) return failure("Essa opção só existe na conta de demonstração.");

  try {
    const supabase = await createClient();
    await clearUserData(supabase, user.id);
    await seedSampleData(supabase, user.id);
    await seedDemoJobProfile(supabase, user.id);
    await seedSampleConcursos(supabase, user.id);
    // Com a chave secreta, os editais de exemplo do catálogo voltam com as datas de hoje.
    await seedDemoConcursoSearch(supabase, user.id, {
      catalog: process.env.SUPABASE_SECRET_KEY ? createAdminClient() : undefined,
    });
    revalidateApp();
    return success();
  } catch (error) {
    unstable_rethrow(error);
    return failure(friendlyDbError(error, "Não foi possível restaurar os dados de exemplo."));
  }
}

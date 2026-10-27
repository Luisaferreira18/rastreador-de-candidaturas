"use server";

import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, type ActionResult } from "@/lib/action-result";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { clearUserData, seedDemoJobProfile, seedSampleData } from "./seed";

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
    revalidateApp();
    return success();
  } catch (error) {
    unstable_rethrow(error);
    return failure(friendlyDbError(error, "Não foi possível restaurar os dados de exemplo."));
  }
}

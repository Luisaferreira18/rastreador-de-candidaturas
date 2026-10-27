"use server";

import { getCurrentUser } from "@/features/auth/session";
import { failure, friendlyDbError, success, type ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPublicBotNumber, getWhatsAppConfig } from "./config";
import { LINK_CODE_TTL_MINUTES, generateLinkCode, hashLinkCode, maskPhone } from "./link-code";

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";

export type WhatsAppStatus = { linked: boolean; phone: string | null; linkedAt: string | null };

/**
 * Começa a vinculação: gera um código de uso único (15 minutos) e o link
 * wa.me que abre o WhatsApp com "vincular CÓDIGO" pronto para enviar.
 */
export async function startWhatsAppLink(): Promise<ActionResult<{ code: string; link: string; expiresAt: string }>> {
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  if (user.isDemo) return failure("A conta de demonstração não pode conectar um WhatsApp.");
  const botNumber = getPublicBotNumber();
  if (!botNumber || !getWhatsAppConfig()) return failure("O WhatsApp ainda não foi configurado neste site.");

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    whatsapp_link_code_hash: hashLinkCode(code),
    whatsapp_link_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) return failure(friendlyDbError(error, "Não foi possível gerar o código."));

  const link = `https://wa.me/${botNumber}?text=${encodeURIComponent(`vincular ${code}`)}`;
  return success({ code, link, expiresAt });
}

export async function getWhatsAppStatus(): Promise<ActionResult<WhatsAppStatus>> {
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("whatsapp_wa_id, whatsapp_linked_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return failure(friendlyDbError(error, "Não foi possível consultar o WhatsApp."));
  return success({
    linked: Boolean(data?.whatsapp_wa_id),
    phone: data?.whatsapp_wa_id ? maskPhone(data.whatsapp_wa_id) : null,
    linkedAt: data?.whatsapp_linked_at ?? null,
  });
}

/** Desconecta o WhatsApp. Só o servidor grava esse campo (veja a migração). */
export async function unlinkWhatsApp(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("user_settings")
      .update({ whatsapp_wa_id: null, whatsapp_linked_at: null })
      .eq("user_id", user.id);
    if (error) throw error;
    return success();
  } catch (error) {
    return failure(friendlyDbError(error, "Não foi possível desconectar o WhatsApp."));
  }
}

import "server-only";
import { loadSnapshotForUser } from "@/features/report/load";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantDeps } from "./assistant";
import type { WhatsAppConfig } from "./config";

/** Envia uma mensagem de texto pela API oficial (ou só registra no log, no modo de teste). */
export async function sendWhatsAppText(config: WhatsAppConfig, to: string, body: string): Promise<void> {
  if (config.dryRun) {
    console.info(`[whatsapp:modo-de-teste] para ${to}:\n${body}`);
    return;
  }
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!response.ok) throw new Error(`A Meta recusou a mensagem (${response.status}): ${await response.text()}`);
}

/**
 * Dependências reais do assistente. Usa o cliente administrativo porque quem
 * chama é a Meta, sem sessão de usuário; toda consulta filtra pelo dono do
 * número já vinculado.
 */
export function createAssistantDeps(config: WhatsAppConfig): AssistantDeps {
  const admin = createAdminClient();

  async function userName(userId: string): Promise<string | null> {
    const { data } = await admin.auth.admin.getUserById(userId);
    const metadata = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    return typeof metadata.full_name === "string" ? metadata.full_name : null;
  }

  return {
    async markProcessed(messageId) {
      const { error } = await admin.from("whatsapp_events").insert({ message_id: messageId });
      if (error?.code === "23505") return false;
      if (error) throw error;
      return true;
    },

    async findUserByWaId(waId) {
      const { data, error } = await admin.from("user_settings").select("user_id").eq("whatsapp_wa_id", waId).maybeSingle();
      if (error) throw error;
      return data ? { userId: data.user_id, name: await userName(data.user_id) } : null;
    },

    async linkByCode(codeHash, waId) {
      const { data, error } = await admin
        .from("user_settings")
        .select("user_id")
        .eq("whatsapp_link_code_hash", codeHash)
        .gt("whatsapp_link_expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // O número provou ser da pessoa: se estava ligado a outra conta, sai de lá.
      const release = await admin
        .from("user_settings")
        .update({ whatsapp_wa_id: null, whatsapp_linked_at: null })
        .eq("whatsapp_wa_id", waId)
        .neq("user_id", data.user_id);
      if (release.error) throw release.error;

      const link = await admin
        .from("user_settings")
        .update({
          whatsapp_wa_id: waId,
          whatsapp_linked_at: new Date().toISOString(),
          whatsapp_link_code_hash: null,
          whatsapp_link_expires_at: null,
        })
        .eq("user_id", data.user_id);
      if (link.error) throw link.error;
      return { userId: data.user_id, name: await userName(data.user_id) };
    },

    async unlink(userId) {
      const { error } = await admin
        .from("user_settings")
        .update({ whatsapp_wa_id: null, whatsapp_linked_at: null })
        .eq("user_id", userId);
      if (error) throw error;
    },

    loadSnapshot: (userId) => loadSnapshotForUser(admin, userId),

    async loadOpenLeads(userId) {
      const [leads, count] = await Promise.all([
        admin
          .from("job_leads")
          .select("company, title, url, score")
          .eq("user_id", userId)
          .eq("status", "nova")
          .order("score", { ascending: false })
          .order("found_at", { ascending: false })
          .limit(5),
        admin
          .from("job_leads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "nova"),
      ]);
      if (leads.error) throw leads.error;
      if (count.error) throw count.error;
      return { total: count.count ?? 0, leads: leads.data ?? [] };
    },

    async loadPendingSuggestions(userId) {
      const { data, error } = await admin
        .from("inbox_items")
        .select("kind, company, subject")
        .eq("user_id", userId)
        .eq("status", "pendente")
        .order("received_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },

    async createSuggestion(userId, parsed, text) {
      const firstLine = text.split("\n").find((line) => line.trim())?.trim() ?? "Mensagem encaminhada";
      const { error } = await admin.from("inbox_items").insert({
        user_id: userId,
        source: "whatsapp",
        subject: firstLine.slice(0, 120),
        snippet: parsed.snippet,
        kind: parsed.kind,
        suggested_stage: parsed.stage,
        // Mensagens encaminhadas sempre passam pela confirmação no app.
        confidence: parsed.confidence === "alta" ? "media" : parsed.confidence,
        company: parsed.company,
        role_title: parsed.roleTitle,
        platform: parsed.platform,
        task_title: parsed.taskTitle,
        due_date: parsed.dueDate,
      });
      if (error) throw error;
    },

    send: (to, body) => sendWhatsAppText(config, to, body),
  };
}

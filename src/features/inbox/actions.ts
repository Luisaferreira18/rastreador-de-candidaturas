"use server";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/session";
import { topPosition } from "@/features/board/board-state";
import { failure, friendlyDbError, success, type ActionResult } from "@/lib/action-result";
import { isValidISODate, todayISO } from "@/lib/format";
import { revalidateApp } from "@/lib/revalidate";
import { STAGE_KEYS } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/types/database";
import { parseMessage } from "./parser";
import { planInboxItem, type InboxPlan, type PlanOverrides } from "./plan";

type Client = SupabaseClient<Database>;
type InboxItem = Tables<"inbox_items">;

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";
const idSchema = z.uuid();

async function loadApplications(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role_title, stage, applied_at, updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

/** Executa o plano no banco (sempre com a sessão do usuário, sob RLS). */
async function executePlan(
  supabase: Client,
  userId: string,
  item: InboxItem,
  plan: Exclude<InboxPlan, { action: "nada" }>,
  auto: boolean,
): Promise<string> {
  let applicationId: string;

  if (plan.action === "criar") {
    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: userId,
        company: plan.company,
        role_title: plan.roleTitle,
        stage: plan.stage,
        platform: plan.platform,
        applied_at: plan.appliedAt,
        notes: item.source === "email" && item.subject ? `Criada a partir do e-mail "${item.subject}".` : null,
        position: topPosition(),
      })
      .select("id")
      .single();
    if (error) throw error;
    applicationId = data.id;
  } else {
    applicationId = plan.applicationId;
    const patch: Database["public"]["Tables"]["applications"]["Update"] = {};
    if (plan.stage) {
      patch.stage = plan.stage;
      patch.position = topPosition();
    }
    if (plan.setAppliedAt) patch.applied_at = plan.setAppliedAt;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("applications").update(patch).eq("id", applicationId).eq("user_id", userId);
      if (error) throw error;
    }
  }

  if (plan.task) {
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      application_id: applicationId,
      title: plan.task.title,
      due_date: plan.task.dueDate,
    });
    if (error) throw error;
  }

  const { error } = await supabase
    .from("inbox_items")
    .update({
      status: "aplicada",
      application_id: applicationId,
      resolution: plan.summary,
      auto_applied: auto,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("user_id", userId);
  if (error) throw error;

  return applicationId;
}

const overridesSchema = z.object({
  applicationId: z.union([z.uuid(), z.literal("nova")]).optional(),
  stage: z.enum(STAGE_KEYS).nullable().optional(),
  company: z.string().trim().max(120).optional(),
  roleTitle: z.string().trim().max(160).optional(),
  taskTitle: z.string().trim().max(200).nullable().optional(),
  dueDate: z
    .string()
    .refine((value) => value === "" || isValidISODate(value), "Data inválida.")
    .nullable()
    .optional(),
});

/** Aplica uma sugestão (com os ajustes feitos na tela). */
export async function applyInboxItem(
  itemId: string,
  overrides: PlanOverrides = {},
): Promise<ActionResult<{ applicationId: string; summary: string }>> {
  if (!idSchema.safeParse(itemId).success) return failure("Sugestão inválida.");
  const parsedOverrides = overridesSchema.safeParse(overrides);
  if (!parsedOverrides.success) return failure("Revise os campos da sugestão.");

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  const supabase = await createClient();

  try {
    const { data: item, error } = await supabase
      .from("inbox_items")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!item) return failure("Essa sugestão não existe mais. Atualize a página.");
    if (item.status !== "pendente") return failure("Essa sugestão já foi resolvida.");

    const cleaned: PlanOverrides = { ...parsedOverrides.data, dueDate: parsedOverrides.data.dueDate || null };
    if (parsedOverrides.data.dueDate === undefined) delete cleaned.dueDate;
    const plan = planInboxItem(item, await loadApplications(supabase, user.id), cleaned);
    if (plan.action === "nada") return failure(plan.reason);

    const applicationId = await executePlan(supabase, user.id, item, plan, false);
    revalidateApp();
    return success({ applicationId, summary: plan.summary });
  } catch (error) {
    return failure(friendlyDbError(error, "Não foi possível aplicar a sugestão. Tente novamente."));
  }
}

export async function ignoreInboxItem(itemId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(itemId).success) return failure("Sugestão inválida.");
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .update({ status: "ignorada", resolution: "Ignorada", resolved_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .eq("status", "pendente")
    .select("id");
  if (error) return failure(friendlyDbError(error, "Não foi possível ignorar a sugestão."));
  if (!data?.length) return failure("Essa sugestão já foi resolvida.");

  revalidateApp();
  return success();
}

/**
 * Aplica sozinho o que é inequívoco (confirmações de inscrição e reprovações
 * com frase clara), se a pessoa deixou a automação ligada. Chamada quando o
 * app abre; devolve o que mudou para mostrar nos avisos.
 */
export async function processInbox(): Promise<ActionResult<{ applied: { summary: string; applicationId: string }[] }>> {
  const user = await getCurrentUser();
  if (!user) return success({ applied: [] });
  const supabase = await createClient();

  try {
    const { data: settings } = await supabase.from("user_settings").select("auto_apply").eq("user_id", user.id).maybeSingle();
    if (settings && !settings.auto_apply) return success({ applied: [] });

    const { data: items, error } = await supabase
      .from("inbox_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .eq("confidence", "alta")
      .order("received_at", { ascending: true })
      .limit(20);
    if (error) throw error;
    if (!items?.length) return success({ applied: [] });

    const applications = await loadApplications(supabase, user.id);
    const applied: { summary: string; applicationId: string }[] = [];
    for (const item of items) {
      const plan = planInboxItem(item, applications);
      if (plan.action === "nada") {
        // Nada a fazer (ex.: e-mail atrasado de etapa anterior): resolve sem mexer na vaga.
        await supabase
          .from("inbox_items")
          .update({ status: "aplicada", resolution: plan.reason, auto_applied: true, resolved_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("user_id", user.id);
        continue;
      }
      const applicationId = await executePlan(supabase, user.id, item, plan, true);
      applied.push({ summary: plan.summary, applicationId });
      // Mantém a lista em dia para os próximos itens (ex.: dois e-mails da mesma vaga).
      applications.splice(0, applications.length, ...(await loadApplications(supabase, user.id)));
    }

    revalidateApp();
    return success({ applied });
  } catch (error) {
    return failure(friendlyDbError(error, "Não foi possível processar a caixa de entrada."));
  }
}

const pasteSchema = z.object({
  text: z.string().trim().min(10, "Cole a mensagem inteira (pelo menos algumas palavras).").max(8000, "Mensagem longa demais."),
});

/** "Colar mensagem": interpreta o texto e cria uma sugestão para você conferir. */
export async function analyzePastedMessage(text: string): Promise<ActionResult<{ itemId: string; relevant: boolean }>> {
  const parsed = pasteSchema.safeParse({ text });
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Mensagem inválida.");

  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const message = parseMessage({ body: parsed.data.text, receivedOn: todayISO() });
  const firstLine = parsed.data.text.split("\n").find((line) => line.trim())?.trim() ?? "Mensagem colada";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .insert({
      user_id: user.id,
      source: "colado",
      subject: firstLine.slice(0, 120),
      snippet: message.snippet,
      kind: message.kind,
      suggested_stage: message.stage,
      // Mensagens coladas sempre passam pela sua confirmação.
      confidence: message.confidence === "alta" ? "media" : message.confidence,
      company: message.company,
      role_title: message.roleTitle,
      platform: message.platform,
      task_title: message.taskTitle,
      due_date: message.dueDate,
    })
    .select("id")
    .single();
  if (error) return failure(friendlyDbError(error, "Não foi possível analisar a mensagem."));

  revalidateApp();
  return success({ itemId: data.id, relevant: message.relevant });
}

/** Gera um token novo para o script do Google (o anterior deixa de funcionar). */
export async function generateInboxToken(): Promise<ActionResult<{ token: string }>> {
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);
  if (user.isDemo) return failure("A conta de demonstração não pode conectar um e-mail.");

  const token = `rdc_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");

  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    inbox_token_hash: hash,
    inbox_token_created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return failure(friendlyDbError(error, "Não foi possível gerar o token."));

  revalidateApp();
  return success({ token });
}

export async function setAutoApply(enabled: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return failure(SESSION_EXPIRED);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, auto_apply: enabled, updated_at: new Date().toISOString() });
  if (error) return failure(friendlyDbError(error, "Não foi possível salvar a preferência."));

  revalidateApp();
  return success();
}

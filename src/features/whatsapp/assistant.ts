/**
 * O "cérebro" do assistente do WhatsApp: recebe uma mensagem, decide o que
 * fazer e devolve a resposta. Não sabe nada de Meta nem de banco: tudo chega
 * pelas dependências (`deps`), o que deixa a lógica fácil de testar.
 *
 * Só responde a mensagens que a pessoa mandou: pela regra da Meta, isso é
 * grátis (até 1.000 respostas por mês por número). O assistente nunca puxa
 * conversa sozinho.
 */

import { agendaLine, concursoAgenda } from "@/features/concursos/agenda";
import { companyKey } from "@/features/inbox/plan";
import { normalize, parseMessage } from "@/features/inbox/parser";
import { KIND_INFO, type InboxKind, type ParsedMessage } from "@/features/inbox/types";
import { buildDailyReport, type ReportConcursoLead, type ReportLead, type ReportSnapshot } from "@/features/report/build";
import { concursoLeadLines, leadLines, renderReportText } from "@/features/report/render";
import { diffDaysISO, formatDate, formatRelativeDay, timestampToISODate } from "@/lib/format";
import { STAGES, getStage, isActiveStage } from "@/lib/stages";
import { extractLinkCode, hashLinkCode } from "./link-code";

export type IncomingWhatsAppMessage = { id: string; from: string; text: string };

export type AssistantDeps = {
  /** Registra a mensagem; devolve false se ela já tinha sido processada (reenvio da Meta). */
  markProcessed(messageId: string): Promise<boolean>;
  findUserByWaId(waId: string): Promise<{ userId: string; name: string | null } | null>;
  /** Vincula o número ao dono do código (se válido e dentro do prazo). */
  linkByCode(codeHash: string, waId: string): Promise<{ userId: string; name: string | null } | null>;
  unlink(userId: string): Promise<void>;
  loadSnapshot(userId: string): Promise<ReportSnapshot>;
  loadPendingSuggestions(userId: string): Promise<{ kind: InboxKind; company: string | null; subject: string | null }[]>;
  createSuggestion(userId: string, parsed: ParsedMessage, text: string): Promise<void>;
  /** Vagas sugeridas ainda não vistas: as 5 de nota mais alta e o total. */
  loadOpenLeads(userId: string): Promise<{ total: number; leads: ReportLead[] }>;
  /** Concursos sugeridos ainda não vistos: os 5 de nota mais alta e o total. */
  loadOpenConcursoLeads(userId: string): Promise<{ total: number; leads: ReportConcursoLead[] }>;
  send(to: string, body: string): Promise<void>;
};

export type AssistantContext = { appUrl: string; today: string };

/** Limite do WhatsApp para uma mensagem de texto. */
const MAX_LENGTH = 4000;

function truncate(text: string): string {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 20)}\n… (continua no app)` : text;
}

export function menuText(name: string | null, appUrl: string): string {
  return [
    `Olá${name ? `, ${name.split(" ")[0]}` : ""}! Sou o assistente do Rastreador de candidaturas. Mande:`,
    "• *resumo*: como estão suas candidaturas hoje",
    "• *prazos*: próximos prazos e atrasos",
    "• *andamento*: vagas em andamento, por etapa",
    "• *sugestões*: o que espera na sua caixa de entrada",
    "• *vagas*: vagas novas compatíveis com o seu perfil",
    "• *concursos*: datas dos seus concursos e concursos novos",
    "• o *nome de uma empresa*: como está aquela vaga",
    "",
    "Também dá para *encaminhar* aqui uma mensagem de recrutador: eu crio a sugestão para você conferir no app.",
    "",
    `Abrir o app: ${appUrl}/painel`,
  ].join("\n");
}

type Command = "menu" | "resumo" | "prazos" | "andamento" | "sugestoes" | "vagas" | "concursos" | "desvincular";

/**
 * Comandos curtos: a mensagem precisa ser o comando, com ou sem cumprimento
 * ("Oi, resumo", "meus prazos?"). Perguntas livres ("oi, como está a Nuvem
 * Pay?") seguem para a busca por empresa.
 */
export function detectCommand(text: string): Command | null {
  const value = normalize(text)
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(oi|ola|bom dia|boa tarde|boa noite)\s+/, "");
  if (value === "" || /^(oi|ola|bom dia|boa tarde|boa noite|menu|ajuda|help|comandos|inicio|start)$/.test(value)) return "menu";
  if (/^(desvincular|desconectar|sair|parar)$/.test(value)) return "desvincular";
  if (/^((me )?(manda|mande|envia|envie) )?(o |meu )?(resumo|relatorio|status)( do dia| de hoje)?$/.test(value)) return "resumo";
  if (/^(meus |os |quais (sao )?(os )?(meus )?)?(prazos|tarefas|pendencias|agenda)( da semana| de hoje)?$/.test(value)) return "prazos";
  if (/^(meus |minhas |as )?(andamento|processos|candidaturas)( em andamento)?$/.test(value)) return "andamento";
  if (/^(minhas vagas|vagas em andamento)$/.test(value)) return "andamento";
  if (/^(novas |as )?vagas( novas| sugeridas| para mim| compativeis)?$/.test(value)) return "vagas";
  if (/^(minhas |as )?(sugestao|sugestoes|caixa|caixa de entrada)$/.test(value)) return "sugestoes";
  if (/^(meus |os |novos )?(concursos?|editais)( novos| abertos| sugeridos| publicos)?$/.test(value)) return "concursos";
  return null;
}

function deadlinesText(snapshot: ReportSnapshot, ctx: AssistantContext): string {
  const report = buildDailyReport(snapshot, ctx.today);
  const line = (task: { title: string; company: string; dueDate: string }) =>
    `• ${task.title} · ${task.company}: ${formatRelativeDay(task.dueDate, ctx.today)}, ${formatDate(task.dueDate)}`;
  const parts: string[] = [];
  if (report.overdue.length) parts.push("*Atrasados*", ...report.overdue.map(line), "");
  if (report.dueToday.length) parts.push("*Hoje*", ...report.dueToday.map(line), "");
  if (report.dueSoon.length) parts.push("*Próximos 7 dias*", ...report.dueSoon.map(line), "");
  if (report.concursoDeadlines.length) {
    parts.push("*Concursos nesta semana*", ...report.concursoDeadlines.map((item) => agendaLine(item, ctx.today)), "");
  }
  if (parts.length === 0) return "Nenhum prazo atrasado nem nos próximos 7 dias. 🎉";
  return parts.join("\n").trim();
}

function progressText(snapshot: ReportSnapshot, ctx: AssistantContext): string {
  const active = snapshot.applications.filter((application) => isActiveStage(application.stage));
  if (active.length === 0) return `Nenhuma candidatura em andamento agora. Que tal cadastrar a próxima? ${ctx.appUrl}/candidaturas/nova`;
  const blocks: string[] = [];
  for (const stage of [...STAGES].reverse()) {
    const items = active.filter((application) => application.stage === stage.key);
    if (items.length === 0) continue;
    blocks.push(
      [
        `*${stage.label}* (${items.length})`,
        ...items.map((application) => {
          const days = diffDaysISO(timestampToISODate(application.stage_changed_at), ctx.today);
          return `• ${application.company}: ${application.role_title} (${days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`})`;
        }),
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

/** Datas dos concursos (alertas da semana e o próximo mês) e os concursos novos sugeridos. */
function concursosText(
  snapshot: ReportSnapshot,
  open: { total: number; leads: ReportConcursoLead[] },
  ctx: AssistantContext,
): string {
  const datesByConcurso = Map.groupBy(snapshot.concursoDates, (item) => item.concurso_id);
  const { alerts, upcoming } = concursoAgenda(
    snapshot.concursos.map((concurso) => ({ ...concurso, dates: datesByConcurso.get(concurso.id) ?? [] })),
    ctx.today,
  );
  const parts: string[] = [];
  if (alerts.length) parts.push("*Atenção nos próximos 7 dias*", ...alerts.map((item) => agendaLine(item, ctx.today)), "");
  if (upcoming.length) {
    parts.push("*Próximas datas*", ...upcoming.slice(0, 8).map((item) => agendaLine(item, ctx.today)));
    if (upcoming.length > 8) parts.push(`E mais ${upcoming.length - 8}.`);
    parts.push("");
  }
  if (open.total > 0) {
    parts.push(`*${open.total === 1 ? "1 concurso novo" : `${open.total} concursos novos`} para você*`, ...concursoLeadLines(open.leads), "");
  }
  if (parts.length === 0) {
    return snapshot.concursos.length === 0
      ? `Você ainda não acompanha nenhum concurso. Cadastre um (ou leia o edital) em ${ctx.appUrl}/concursos/novo, ou monte o perfil para receber sugestões: ${ctx.appUrl}/concursos/perfil`
      : `Nenhuma data de concurso nos próximos 30 dias e nenhum concurso novo. Seus concursos: ${ctx.appUrl}/concursos`;
  }
  parts.push("A inscrição e o pagamento são sempre no site oficial da banca.", `Seus concursos: ${ctx.appUrl}/concursos`);
  return parts.join("\n").trim();
}

/** Acha a empresa citada na mensagem ("como está a Nuvem Pay?"). */
export function findCompanyInText(text: string, snapshot: ReportSnapshot) {
  const haystack = companyKey(text);
  let best: ReportSnapshot["applications"][number] | null = null;
  for (const application of snapshot.applications) {
    const key = companyKey(application.company);
    if (key.length >= 3 && haystack.includes(key)) {
      const better =
        !best ||
        key.length > companyKey(best.company).length ||
        (key.length === companyKey(best.company).length && isActiveStage(application.stage) && !isActiveStage(best.stage));
      if (better) best = application;
    }
  }
  return best;
}

function companyText(application: ReportSnapshot["applications"][number], snapshot: ReportSnapshot, ctx: AssistantContext): string {
  const days = diffDaysISO(timestampToISODate(application.stage_changed_at), ctx.today);
  const nextTask = snapshot.tasks
    .filter((task) => task.application_id === application.id)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  return [
    `*${application.company}* · ${application.role_title}`,
    `Etapa: ${getStage(application.stage).label} (${days === 0 ? "desde hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`})`,
    nextTask
      ? `Próximo passo: ${nextTask.title}${nextTask.due_date ? ` (${formatRelativeDay(nextTask.due_date, ctx.today)}, ${formatDate(nextTask.due_date)})` : ""}`
      : "Sem próximos passos anotados.",
    application.applied_at ? `Candidatura enviada em ${formatDate(application.applied_at)}` : "Ainda não se candidatou.",
    `${ctx.appUrl}/candidaturas/${application.id}`,
  ].join("\n");
}

/** Processa uma mensagem e devolve o texto respondido (ou null se ignorada). */
export async function handleIncomingMessage(
  deps: AssistantDeps,
  message: IncomingWhatsAppMessage,
  ctx: AssistantContext,
): Promise<string | null> {
  if (!(await deps.markProcessed(message.id))) return null;
  const reply = truncate(await buildReply(deps, message, ctx));
  await deps.send(message.from, reply);
  return reply;
}

async function buildReply(deps: AssistantDeps, message: IncomingWhatsAppMessage, ctx: AssistantContext): Promise<string> {
  const text = message.text.trim();

  // 1. Vinculação: "vincular RDC-XXXXXX" (prova de que o número é da pessoa).
  const code = extractLinkCode(text);
  if (code) {
    const linked = await deps.linkByCode(hashLinkCode(code), message.from);
    if (!linked) return `Esse código é inválido ou expirou. Gere um novo em ${ctx.appUrl}/conexoes.`;
    return [`Pronto! Este WhatsApp está conectado ao seu Rastreador de candidaturas.`, "", menuText(linked.name, ctx.appUrl)].join("\n");
  }

  const user = await deps.findUserByWaId(message.from);
  if (!user) {
    return `Olá! Para eu responder sobre as suas candidaturas, conecte este número em ${ctx.appUrl}/conexoes. Leva menos de um minuto.`;
  }

  // 2. Comandos curtos.
  const command = detectCommand(text);
  if (command === "menu") return menuText(user.name, ctx.appUrl);
  if (command === "desvincular") {
    await deps.unlink(user.userId);
    return `Pronto, este WhatsApp foi desconectado. Para conectar de novo, use ${ctx.appUrl}/conexoes.`;
  }
  if (command === "sugestoes") {
    const items = await deps.loadPendingSuggestions(user.userId);
    if (items.length === 0) return "Sua caixa de entrada está em dia: nenhuma sugestão para conferir.";
    return [
      `*${items.length === 1 ? "1 sugestão" : `${items.length} sugestões`} para conferir*`,
      ...items.slice(0, 10).map((item) => `• ${KIND_INFO[item.kind].label}${item.company ? `: ${item.company}` : item.subject ? `: ${item.subject}` : ""}`),
      "",
      `Conferir e aplicar: ${ctx.appUrl}/caixa-de-entrada`,
    ].join("\n");
  }

  if (command === "vagas") {
    const { total, leads } = await deps.loadOpenLeads(user.userId);
    if (total === 0) {
      return `Nenhuma vaga nova por enquanto. A busca roda todo dia; para ajustar o que procura: ${ctx.appUrl}/vagas/perfil`;
    }
    return [
      `*${total === 1 ? "1 vaga nova" : `${total} vagas novas`} para você*`,
      ...leadLines(leads),
      "",
      `Adicionar ao quadro: ${ctx.appUrl}/vagas`,
    ].join("\n");
  }

  if (command === "concursos") {
    const [snapshot, open] = await Promise.all([deps.loadSnapshot(user.userId), deps.loadOpenConcursoLeads(user.userId)]);
    return concursosText(snapshot, open, ctx);
  }

  const snapshot = await deps.loadSnapshot(user.userId);
  if (command === "resumo") return renderReportText(buildDailyReport(snapshot, ctx.today), ctx.appUrl, { bold: true });
  if (command === "prazos") return deadlinesText(snapshot, ctx);
  if (command === "andamento") return progressText(snapshot, ctx);

  // 3. Mensagem de recrutador encaminhada: vira sugestão na caixa de entrada.
  if (text.length >= 40) {
    const parsed = parseMessage({ body: text, receivedOn: ctx.today });
    if (parsed.relevant && parsed.kind !== "outro") {
      await deps.createSuggestion(user.userId, parsed, text);
      const stage = parsed.stage ? getStage(parsed.stage).label : null;
      return [
        `Anotei uma sugestão: ${[parsed.company, stage].filter(Boolean).join(" → ") || KIND_INFO[parsed.kind].label}${parsed.dueDate ? ` (prazo ${formatDate(parsed.dueDate)})` : ""}.`,
        `Confira e aplique: ${ctx.appUrl}/caixa-de-entrada`,
      ].join("\n");
    }
  }

  // 4. Nome de empresa.
  const application = findCompanyInText(text, snapshot);
  if (application) return companyText(application, snapshot, ctx);

  return ["Não entendi. 😅", "", menuText(user.name, ctx.appUrl)].join("\n");
}

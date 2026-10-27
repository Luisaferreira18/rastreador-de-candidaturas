/**
 * Transforma o relatório em e-mail (HTML + texto) e em mensagem de WhatsApp.
 * Todo texto vindo do usuário passa por escapeHtml no e-mail.
 */

import { formatDate, formatDateShort, formatPercent, formatRelativeDay } from "@/lib/format";
import { getStage } from "@/lib/stages";
import { describeChange, type DailyReport, type ReportLead, type ReportTask } from "./build";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function reportSubject(report: DailyReport): string {
  return `Resumo de ${formatDateShort(report.today)}: ${report.headline}`;
}

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

const COLORS = { text: "#1f1f28", muted: "#6b6b7b", border: "#e6e6ee", accent: "#5550d8", danger: "#dc2626", warn: "#d97706" };

function taskRowsHtml(tasks: ReportTask[], today: string, color: string): string {
  return tasks
    .map(
      (task) => `<tr>
  <td style="padding:6px 0;border-bottom:1px solid ${COLORS.border}">
    <div style="font-size:14px;color:${COLORS.text}">${escapeHtml(task.title)}</div>
    <div style="font-size:12px;color:${COLORS.muted}">${escapeHtml(task.company)}</div>
  </td>
  <td style="padding:6px 0 6px 12px;border-bottom:1px solid ${COLORS.border};text-align:right;white-space:nowrap;font-size:13px;color:${color}">
    ${escapeHtml(capitalize(formatRelativeDay(task.dueDate, today)))}<br><span style="font-size:12px;color:${COLORS.muted}">${formatDate(task.dueDate)}</span>
  </td>
</tr>`,
    )
    .join("");
}

function section(title: string, body: string): string {
  return `<h2 style="margin:24px 0 8px;font-size:15px;color:${COLORS.text}">${title}</h2>${body}`;
}

export function renderReportEmail(report: DailyReport, appUrl: string): { subject: string; html: string; text: string } {
  const parts: string[] = [];
  const t = report.today;

  if (report.overdue.length || report.dueToday.length || report.dueSoon.length) {
    const rows =
      taskRowsHtml(report.overdue, t, COLORS.danger) +
      taskRowsHtml(report.dueToday, t, COLORS.warn) +
      taskRowsHtml(report.dueSoon, t, COLORS.text);
    parts.push(section("Prazos", `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>`));
  }

  if (report.changes.length) {
    const items = report.changes
      .map((change) => `<li style="margin:4px 0">${escapeHtml(describeChange(change))}</li>`)
      .join("");
    parts.push(section("O que mudou desde ontem", `<ul style="margin:0;padding-left:18px;font-size:14px;color:${COLORS.text}">${items}</ul>`));
  }

  if (report.pendingSuggestions > 0) {
    parts.push(
      section(
        "Caixa de entrada",
        `<p style="margin:0;font-size:14px;color:${COLORS.text}">${report.pendingSuggestions === 1 ? "1 sugestão espera" : `${report.pendingSuggestions} sugestões esperam`} a sua confirmação. <a href="${escapeHtml(appUrl)}/caixa-de-entrada" style="color:${COLORS.accent}">Conferir</a></p>`,
      ),
    );
  }

  if (report.newLeads.length) {
    const items = report.newLeads
      .map(
        (lead) =>
          `<li style="margin:6px 0"><a href="${escapeHtml(lead.url)}" style="color:${COLORS.accent};text-decoration:none">${escapeHtml(lead.title)}</a> <span style="color:${COLORS.muted}">· ${escapeHtml(lead.company)} · ${lead.score}% compatível</span></li>`,
      )
      .join("");
    const more =
      report.newLeadsCount > report.newLeads.length
        ? `E mais ${report.newLeadsCount - report.newLeads.length}. `
        : "";
    parts.push(
      section(
        "Vagas novas para você",
        `<ul style="margin:0;padding-left:18px;font-size:14px;color:${COLORS.text}">${items}</ul><p style="margin:8px 0 0;font-size:13px;color:${COLORS.muted}">${more}<a href="${escapeHtml(appUrl)}/vagas" style="color:${COLORS.accent}">Ver todas e adicionar ao quadro</a></p>`,
      ),
    );
  }

  if (report.stale.length) {
    const items = report.stale
      .map(
        (item) =>
          `<li style="margin:4px 0">${escapeHtml(item.company)} <span style="color:${COLORS.muted}">(${escapeHtml(getStage(item.stage).label)} há ${item.days} dias)</span></li>`,
      )
      .join("");
    parts.push(
      section(
        "Sem novidades há um tempo",
        `<p style="margin:0 0 6px;font-size:13px;color:${COLORS.muted}">Vale mandar uma mensagem perguntando sobre o andamento.</p><ul style="margin:0;padding-left:18px;font-size:14px;color:${COLORS.text}">${items}</ul>`,
      ),
    );
  }

  const n = report.numbers;
  parts.push(
    section(
      "Números",
      `<p style="margin:0;font-size:14px;color:${COLORS.text}">${n.active} em andamento · ${n.sentThisWeek} ${n.sentThisWeek === 1 ? "enviada" : "enviadas"} nesta semana · taxa de resposta ${formatPercent(n.responseRate)} · ${n.total} no total</p>`,
    ),
  );

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;color:${COLORS.muted}">Rastreador de candidaturas · ${formatDate(t)}</p>
    <h1 style="margin:0;font-size:20px;color:${COLORS.text}">${escapeHtml(capitalize(report.headline))}</h1>
    ${report.isEmpty ? `<p style="margin:12px 0 0;font-size:14px;color:${COLORS.muted}">Nenhum prazo, novidade ou pendência por enquanto. Bom dia de candidaturas!</p>` : ""}
    ${parts.join("\n")}
    <p style="margin:28px 0 0"><a href="${escapeHtml(appUrl)}/painel" style="display:inline-block;background:${COLORS.accent};color:#ffffff;text-decoration:none;font-size:14px;padding:10px 16px;border-radius:8px">Abrir o painel</a></p>
  </div>
  <p style="margin:12px 0 0;font-size:11px;color:${COLORS.muted};text-align:center">Você recebe este resumo porque ativou o relatório diário no script do Google. Para parar, rode a função "desligar" no script.</p>
</div></body></html>`;

  return { subject: reportSubject(report), html, text: renderReportText(report, appUrl) };
}

// ---------------------------------------------------------------------------
// Texto (corpo alternativo do e-mail e WhatsApp)
// ---------------------------------------------------------------------------

/** "• 92% · Estágio em Dados · Vertem" e o link na linha de baixo. */
export function leadLines(leads: readonly ReportLead[]): string[] {
  return leads.flatMap((lead) => [`• ${lead.score}% · ${lead.title} · ${lead.company}`, `  ${lead.url}`]);
}

function taskLines(tasks: ReportTask[], today: string): string[] {
  return tasks.map((task) => `• ${task.title} · ${task.company}: ${formatRelativeDay(task.dueDate, today)}, ${formatDate(task.dueDate)}`);
}

/**
 * Texto simples. Com `bold`, usa *negrito* do WhatsApp nos títulos.
 */
export function renderReportText(report: DailyReport, appUrl: string, { bold = false } = {}): string {
  const b = (text: string) => (bold ? `*${text}*` : text);
  const t = report.today;
  const lines: string[] = [b(`Resumo de ${formatDateShort(t)}: ${report.headline}`)];

  if (report.isEmpty) lines.push("", "Nenhum prazo, novidade ou pendência por enquanto.");

  if (report.overdue.length) lines.push("", b("Atrasados"), ...taskLines(report.overdue, t));
  if (report.dueToday.length) lines.push("", b("Hoje"), ...taskLines(report.dueToday, t));
  if (report.dueSoon.length) lines.push("", b("Próximos 7 dias"), ...taskLines(report.dueSoon, t));
  if (report.changes.length) lines.push("", b("O que mudou desde ontem"), ...report.changes.map((change) => `• ${describeChange(change)}`));
  if (report.pendingSuggestions > 0) {
    lines.push("", b("Caixa de entrada"), `• ${report.pendingSuggestions === 1 ? "1 sugestão para conferir" : `${report.pendingSuggestions} sugestões para conferir`}: ${appUrl}/caixa-de-entrada`);
  }
  if (report.newLeads.length) {
    lines.push("", b("Vagas novas para você"), ...leadLines(report.newLeads));
    if (report.newLeadsCount > report.newLeads.length) lines.push(`E mais ${report.newLeadsCount - report.newLeads.length}.`);
    lines.push(`Ver todas: ${appUrl}/vagas`);
  }
  if (report.stale.length) {
    lines.push("", b("Sem novidades há um tempo"), ...report.stale.map((item) => `• ${item.company} (${getStage(item.stage).label} há ${item.days} dias)`));
  }
  const n = report.numbers;
  lines.push(
    "",
    b("Números"),
    `${n.active} em andamento · ${n.sentThisWeek} ${n.sentThisWeek === 1 ? "enviada" : "enviadas"} nesta semana · resposta ${formatPercent(n.responseRate)}`,
  );
  return lines.join("\n");
}

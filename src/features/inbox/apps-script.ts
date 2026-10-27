/**
 * Script do Google Apps Script que roda na conta Google da própria pessoa,
 * de graça:
 * - a cada 10 minutos, procura e-mails de processos seletivos no Gmail e envia para o app;
 * - todo dia de manhã, busca o resumo no app e manda para o próprio Gmail.
 * Nada além desses e-mails sai da caixa de entrada.
 */

/** Busca do Gmail: plataformas de recrutamento ou assuntos típicos de processos. */
export const GMAIL_QUERY =
  "(from:(gupy.io OR linkedin.com OR kenoby.com OR solides.com.br OR inhire.com.br OR pandape OR vagas.com.br " +
  "OR indeed.com OR infojobs OR catho OR 99jobs OR ciee OR nube OR recrutei OR abler OR greenhouse.io OR lever.co " +
  "OR myworkday OR smartrecruiters OR teamtailor) OR subject:(candidatura OR \"processo seletivo\" OR entrevista " +
  "OR \"teste online\" OR inscrição OR vaga OR proposta OR recrutamento OR seleção))";

export const DEFAULT_REPORT_HOUR = 7;

export function buildAppsScript({
  site,
  token,
  reportHour = DEFAULT_REPORT_HOUR,
}: {
  site: string;
  token: string;
  reportHour?: number | null;
}): string {
  return `/**
 * Rastreador de candidaturas
 * - Envia e-mails de processos seletivos para o app (a cada 10 minutos).
 * - Manda um resumo diário para o seu Gmail.
 *
 * Como usar:
 * 1. Clique em "Executar" com a função "configurar" selecionada (só uma vez).
 * 2. Autorize o acesso ao Gmail quando o Google pedir.
 */

const CONFIG = {
  site: ${JSON.stringify(site)},
  token: ${JSON.stringify(token)},
  // Hora do resumo diário (0 a 23). Use null para não receber o resumo.
  horaDoResumo: ${reportHour === null ? "null" : String(reportHour)},
};

const BUSCA = ${JSON.stringify(GMAIL_QUERY)};

/** Rode uma vez: agenda as tarefas e importa os e-mails dos últimos 14 dias. */
function configurar() {
  desligar();
  ScriptApp.newTrigger("verificarEmails").timeBased().everyMinutes(10).create();
  if (CONFIG.horaDoResumo !== null) {
    ScriptApp.newTrigger("enviarResumo").timeBased().everyDays(1).atHour(CONFIG.horaDoResumo).create();
  }
  verificarEmails(14);
}

/** Procura e-mails recentes que combinam com a busca e envia os que ainda não foram enviados. */
function verificarEmails(dias) {
  const propriedades = PropertiesService.getScriptProperties();
  const enviados = JSON.parse(propriedades.getProperty("enviados") || "[]");
  const janela = typeof dias === "number" ? dias : 2;
  const conversas = GmailApp.search(BUSCA + " newer_than:" + janela + "d", 0, 50);
  const limite = new Date(Date.now() - janela * 24 * 60 * 60 * 1000);

  const mensagens = [];
  conversas.forEach(function (conversa) {
    conversa.getMessages().forEach(function (mensagem) {
      const id = mensagem.getId();
      if (enviados.indexOf(id) !== -1 || mensagem.getDate() < limite) return;
      mensagens.push({
        id: id,
        from: mensagem.getFrom(),
        subject: mensagem.getSubject(),
        date: mensagem.getDate().toISOString(),
        body: mensagem.getPlainBody().slice(0, 8000),
      });
    });
  });

  for (let i = 0; i < mensagens.length; i += 50) {
    const lote = mensagens.slice(i, i + 50);
    const resposta = UrlFetchApp.fetch(CONFIG.site + "/api/inbox/email", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + CONFIG.token },
      payload: JSON.stringify({ emails: lote }),
      muteHttpExceptions: true,
    });
    if (resposta.getResponseCode() !== 200) {
      console.log("Erro ao enviar (" + resposta.getResponseCode() + "): " + resposta.getContentText());
      return;
    }
    lote.forEach(function (mensagem) {
      enviados.push(mensagem.id);
    });
    console.log(resposta.getContentText());
  }
  propriedades.setProperty("enviados", JSON.stringify(enviados.slice(-800)));
}

/** Busca o resumo do dia no app e manda para o seu próprio Gmail. Pode rodar à mão para testar. */
function enviarResumo() {
  const resposta = UrlFetchApp.fetch(CONFIG.site + "/api/report", {
    method: "post",
    headers: { Authorization: "Bearer " + CONFIG.token },
    muteHttpExceptions: true,
  });
  if (resposta.getResponseCode() !== 200) {
    console.log("Erro ao buscar o resumo (" + resposta.getResponseCode() + "): " + resposta.getContentText());
    return;
  }
  const resumo = JSON.parse(resposta.getContentText());
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: resumo.assunto,
    htmlBody: resumo.html,
    body: resumo.texto,
    name: "Rastreador de candidaturas",
  });
  console.log("Resumo enviado: " + resumo.assunto);
}

/** Para desligar tudo: remove os agendamentos. */
function desligar() {
  ScriptApp.getProjectTriggers().forEach(function (gatilho) {
    ScriptApp.deleteTrigger(gatilho);
  });
}
`;
}

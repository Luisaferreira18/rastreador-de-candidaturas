/**
 * Leitor de mensagens de processos seletivos, por regras (sem IA, sem custo).
 *
 * Recebe um e-mail ou um texto colado e descobre:
 * - se a mensagem é sobre um processo seletivo (alertas de "novas vagas" ficam de fora);
 * - o tipo (confirmação, teste, entrevista, proposta, reprovação...) e a etapa;
 * - a empresa, o cargo, a plataforma e uma data de prazo, quando aparecem.
 *
 * É uma função pura: fácil de testar e de trocar por uma IA no futuro.
 */

import { addDaysISO, isValidISODate } from "@/lib/format";
import type { Platform } from "@/lib/options";
import { KIND_INFO, type IncomingMessage, type InboxConfidence, type InboxKind, type ParsedMessage } from "./types";

/** Minúsculas, sem acentos e com espaços simples. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[ \t ]+/g, " ");
}

// ---------------------------------------------------------------------------
// Regras de classificação (sobre o texto normalizado)
// ---------------------------------------------------------------------------

type Rule = {
  kind: InboxKind;
  /** Frases inequívocas: geram confiança alta (para confirmação e reprovação). */
  strong: RegExp[];
  /** Pistas mais fracas: viram sugestão para você confirmar. */
  weak?: RegExp[];
  /** Se aparecer, a regra não vale (ex.: "aprovado para a próxima etapa" não é aprovação final). */
  unless?: RegExp;
};

const REJECTION: Rule = {
  kind: "reprovacao",
  strong: [
    /nao (seguiremos|vamos seguir|vamos prosseguir|prosseguiremos|daremos (continuidade|sequencia|seguimento))/,
    /nao (poderemos|podemos|iremos|vamos) (seguir|prosseguir|avancar|dar (continuidade|sequencia)) com (a |o )?(sua|seu|voce)/,
    /(seguir|prosseguir|continuar|avancar) com outr[oa]s? (candidat|perfis|profissionais|pessoas)/,
    /optamos por (seguir|prosseguir|continuar|dar continuidade) com outr/,
    /(voce )?nao (foi|esta|fomos) (selecionad|aprovad|classificad)/,
    /(seu perfil|sua candidatura) nao (foi selecionad|avancou|seguira|sera considerad)/,
    /decidimos (nao (seguir|avancar|prosseguir)|seguir com outr)/,
    /processo( seletivo)? (foi )?(encerrado|finalizado) para (voce|sua candidatura)/,
    /not (be )?moving forward|decided to (move|proceed|go) forward with other|regret to inform/,
  ],
  weak: [/infelizmente/, /vaga (foi )?(encerrada|cancelada|congelada)/, /unfortunately/],
};

const APPROVAL: Rule = {
  kind: "aprovacao",
  strong: [
    /(voce foi|voce esta|foi) (aprovad|contratad|selecionad)[oa]?(\(a\))? (para (a|o) (vaga|posicao|cargo|programa)|no processo)/,
    /seja bem[- ]vind[oa]( \(a\))? (ao time|a equipe|a empresa|ao programa|a familia)/,
    /documentos? (para|da|de) (sua )?(admissao|contratacao)/,
    /exame admissional/,
  ],
  unless: /proxima (etapa|fase)|etapa seguinte|segue para|seguir para a|avancou para|avancar para/,
};

const OFFER: Rule = {
  kind: "proposta",
  strong: [
    /(carta|proposta) (de )?(oferta|emprego|trabalho|estagio|contratacao)/,
    /(temos|preparamos|gostariamos de (fazer|apresentar|enviar)) (uma |a )?proposta/,
    /proposta (salarial|formal|final)/,
    /offer letter|job offer/,
  ],
};

const CONFIRMATION: Rule = {
  kind: "confirmacao",
  strong: [
    /recebemos (a )?sua (candidatura|inscricao|aplicacao)/,
    /(candidatura|inscricao|aplicacao) (foi )?(enviada|recebida|realizada|confirmada|concluida|registrada) (com sucesso|para)/,
    /sua (candidatura|inscricao) (foi )?(enviada|recebida|realizada|confirmada|concluida|registrada)/,
    /obrigad[oa] (por|pela) (se candidatar|sua candidatura|sua inscricao|candidatar-se)/,
    /voce se candidatou/,
    /your application (was|has been) (sent|received|submitted)|application received|thank you for applying/,
  ],
};

/** Etapas do meio do processo: vence a que aparece primeiro (no assunto, depois no texto). */
const MIDDLE_RULES: Rule[] = [
  {
    kind: "entrevista_tecnica",
    strong: [
      /entrevista (tecnica|com (o |a )?(gestor|gestora|lider|lideranca|time tecnico|area tecnica|coordenador))/,
      /(painel|conversa|bate[- ]papo) tecnic/,
      /technical interview/,
    ],
  },
  {
    kind: "entrevista_rh",
    strong: [
      /entrevista/,
      /bate[- ]papo/,
      /(agendar|marcar|agendamos|marcamos|agende|marque) (uma |um |sua |seu |o |a )?(conversa|entrevista|horario|call|reuniao|video ?chamada)/,
      /conversa com (o |a |nosso |nossa )?(rh|recrutador|recrutadora|time de pessoas|time de talentos|talent)/,
      /interview/,
    ],
  },
  {
    kind: "dinamica",
    strong: [/dinamica( de grupo)?/, /\bcase\b/, /estudo de caso/, /desafio (tecnico|pratico)/, /\bdesafio\b/],
  },
  {
    kind: "teste",
    strong: [
      /testes? (online|on-line|de (logica|ingles|perfil|raciocinio|conhecimentos?|personalidade)|comportamenta)/,
      /avaliacao (online|on-line|de (perfil|ingles|logica|conhecimentos?))/,
      /etapa de testes?/,
      /questionario/,
      /assessment/,
    ],
  },
];

/** Assuntos típicos de alertas e newsletters (não são sobre a sua candidatura). */
const NOISE = [
  /novas? vagas?/,
  /\d+ vagas?/,
  /vagas? (recomendadas|sugeridas|que combinam|para voce|parecidas|em alta|abertas)/,
  /alerta de vagas?/,
  /job alert|jobs? you may|recommended jobs/,
  /oportunidades? (para voce|recomendadas|que combinam)/,
  /confira (as|estas|essas|novas) vagas/,
  /newsletter|webinar/,
  /(quem viu|visualizou) seu perfil|seu perfil (foi visto|apareceu)/,
];

const PROCESS_WORDS =
  /processo seletivo|candidatura|recrutamento|recrutador|recrutadora|selecao|inscricao|vaga de|sua vaga|etapa/;

function firstIndex(text: string, patterns: RegExp[]): number {
  let best = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && (best === -1 || match.index < best)) best = match.index;
  }
  return best;
}

function matches(rule: Rule, text: string): "strong" | "weak" | null {
  if (rule.unless?.test(text)) return null;
  if (rule.strong.some((pattern) => pattern.test(text))) return "strong";
  if (rule.weak?.some((pattern) => pattern.test(text))) return "weak";
  return null;
}

export function classify(
  subject: string,
  bodyText: string,
): { kind: InboxKind; confidence: InboxConfidence; relevant: boolean } {
  const normalizedSubject = normalize(subject);
  const all = `${normalizedSubject}\n${normalize(bodyText)}`;

  // 1. Frases inequívocas de desfecho ou de inscrição.
  for (const rule of [REJECTION, APPROVAL, OFFER, CONFIRMATION]) {
    if (matches(rule, all) === "strong") {
      const sure = rule.kind === "confirmacao" || rule.kind === "reprovacao";
      return { kind: rule.kind, confidence: sure ? "alta" : "media", relevant: true };
    }
  }

  // 2. Alertas de vagas: o assunto denuncia, e eles não têm frases de processo.
  if (NOISE.some((pattern) => pattern.test(normalizedSubject))) {
    return { kind: "outro", confidence: "baixa", relevant: false };
  }

  // 3. Etapas do meio do processo. A mensagem costuma citar etapas passadas ("seu case
  // ficou ótimo") e a próxima ("vamos marcar uma entrevista"); vale a próxima. Procura,
  // em ordem: no assunto; depois de "próxima etapa"; perto de verbos de convite; no texto todo.
  const body = normalize(bodyText);
  const nextStepAnchor = /proxim[ao] (etapa|fase|passo)|passou para|avancou para|segue para|segu(e|ira) para/.exec(body);
  const scopes = [
    normalizedSubject,
    nextStepAnchor ? body.slice(nextStepAnchor.index) : "",
    [...body.matchAll(/(agendar|agendamos|marcar|marcamos|convidar|convite|convidamos|participar|realizar|confirmar)[^.!?\n]{0,70}/g)]
      .map((match) => match[0])
      .join("\n"),
    all,
  ];
  for (const scope of scopes) {
    if (!scope) continue;
    let winner: { kind: InboxKind; index: number } | null = null;
    for (const rule of MIDDLE_RULES) {
      const index = firstIndex(scope, rule.strong);
      if (index !== -1 && (!winner || index < winner.index)) winner = { kind: rule.kind, index };
    }
    // "Marcar uma entrevista com o gestor": a entrevista técnica é mais específica que a genérica.
    if (winner?.kind === "entrevista_rh" && firstIndex(scope, MIDDLE_RULES[0].strong) !== -1) {
      winner = { kind: "entrevista_tecnica", index: winner.index };
    }
    if (winner) return { kind: winner.kind, confidence: "media", relevant: true };
  }

  // 4. Pistas fracas ("infelizmente") só contam se nada acima explicou a mensagem.
  if (matches(REJECTION, all) === "weak") return { kind: "reprovacao", confidence: "media", relevant: true };

  if (PROCESS_WORDS.test(all) && !NOISE.some((pattern) => pattern.test(all))) {
    return { kind: "outro", confidence: "baixa", relevant: true };
  }
  return { kind: "outro", confidence: "baixa", relevant: false };
}

// ---------------------------------------------------------------------------
// Remetente, plataforma e empresa
// ---------------------------------------------------------------------------

const PLATFORMS: { pattern: RegExp; platform: Platform; name: string }[] = [
  { pattern: /gupy/, platform: "gupy", name: "gupy" },
  { pattern: /linkedin/, platform: "linkedin", name: "linkedin" },
  {
    pattern:
      /kenoby|solides|inhire|pandape|vagas\.com|indeed|infojobs|catho|99jobs|ciadetalentos|ciee|nube|recrutei|abler|greenhouse|lever\.co|workday|smartrecruiters|breezy|teamtailor|jobvite|taqe|empregare/,
    platform: "outra",
    name: "",
  },
];

const GENERIC_MAIL = /(^|\.)(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|bol|uol|terra|proton|protonmail)\./;

export type Sender = { name: string | null; email: string | null; domain: string | null };

/** "Banco Aurora via Gupy <noreply@gupy.io>" → nome, e-mail e domínio. */
export function parseSender(from: string | null | undefined): Sender {
  if (!from) return { name: null, email: null, domain: null };
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  const name = match ? match[1].trim() || null : null;
  const email = (match ? match[2] : from).trim().toLowerCase();
  const domain = email.includes("@") ? email.split("@")[1] : null;
  return { name, email: email.includes("@") ? email : null, domain };
}

export function detectPlatform(sender: Sender): Platform | null {
  const haystack = normalize(`${sender.domain ?? ""} ${sender.name ?? ""}`);
  for (const item of PLATFORMS) if (item.pattern.test(haystack)) return item.platform;
  if (sender.domain && !GENERIC_MAIL.test(sender.domain)) return "site_empresa";
  return null;
}

const COMPANY_STOP =
  /\b(processo|seletivo|candidatura|inscricao|vaga|vagas|entrevista|teste|testes|etapa|fase|recrutamento|obrigad[oa]|parabens|convite|atualizacao|retorno|feedback|resultado|desafio|case|dinamica|proposta|tecnic[oa]|aprovad[oa]|reprovad[oa]|agendamento|lembrete|oportunidade|sua|seu|voce)\b/;

function cleanCompany(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value = raw
    .replace(/\s+(via|pela|por|from|at|@)\s+.*$/i, "")
    .replace(/\b(equipe|time|departamento|setor)\s+(de\s+)?(recrutamento|talentos|pessoas|rh|recursos humanos|carreiras)\b/gi, "")
    .replace(/\b(recrutamento|talentos|carreiras|careers|jobs|vagas|rh|recursos humanos|people|noreply|no-reply)\b/gi, "")
    .replace(/^[\s\-–|:,.]+|[\s\-–|:,.!]+$/g, "")
    .replace(/^(a|o|na|no|da|do)\s+/i, "")
    .trim();
  if (value.length < 2 || value.length > 60) return null;
  if (value.split(/\s+/).length > 6) return null;
  const normalized = normalize(value);
  if (COMPANY_STOP.test(normalized)) return null;
  if (PLATFORMS.some((item) => item.name && normalized === item.name)) return null;
  value = value.replace(/\s{2,}/g, " ");
  return value;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Recorta o nome próprio do começo do texto: "Nuvem Pay e gostaríamos" → "Nuvem Pay".
 * Aceita palavras com alguma maiúscula (inclusive "iFood"), números e conectores entre elas.
 */
function takeProperNoun(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const tokens = raw.trim().split(/\s+/);
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/[A-ZÀ-Ý0-9&]/.test(token)) kept.push(token);
    else if (/^(de|da|do|das|dos|e)$/i.test(token) && tokens[i + 1] && /[A-ZÀ-Ý0-9]/.test(tokens[i + 1])) kept.push(token);
    else break;
  }
  return kept.join(" ") || undefined;
}

const COMPANY_PATTERNS: RegExp[] = [
  /candidatura (?:foi )?enviada para (?:a |o )?([^\n.!|]{2,60})/i,
  /application was sent to ([^\n.!|]{2,60})/i,
  /processo seletivo (?:da|do|de|na|no) ([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,60})/,
  /\bvaga\b[^\n]{0,80}? (?:na|no) ([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,50})/,
  /(?:posição|posicao|cargo) de [^\n]{0,80}? (?:na|no) ([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,50})/,
  /(?:\brh|recrutamento|talentos|recursos humanos) (?:da|do) ([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,50})/i,
  /(?:ao|à|a) (?:time|equipe|família|familia) (?:da |do )?([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,50})/,
  /(?:equipe|time) (?:de )?(?:recrutamento|talentos|pessoas|rh|gente)(?: e [a-zà-ú]+)? (?:da|do) ([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,50})/,
  /bem[- ]vind[oa](?: \(a\))? (?:à|ao|a) ([A-ZÀ-Ý0-9][^\n.,!|;:()]{1,50})/,
];

export function extractCompany(subject: string, body: string, sender: Sender): string | null {
  const text = `${subject}\n${body}`;
  for (const pattern of COMPANY_PATTERNS) {
    const company = cleanCompany(takeProperNoun(pattern.exec(text)?.[1]));
    if (company) return company;
  }

  // Assunto como "[Banco Aurora] Atualização" ou "Banco Aurora | Candidatura recebida".
  const bracket = /^\s*\[([^\]]{2,60})\]/.exec(subject)?.[1];
  const fromBracket = cleanCompany(bracket);
  if (fromBracket) return fromBracket;
  const parts = subject.split(/\s+[|–-]\s+/);
  if (parts.length > 1) {
    for (const part of parts) {
      const candidate = cleanCompany(part);
      if (candidate && !PROCESS_WORDS.test(normalize(part))) return candidate;
    }
  }

  // Nome do remetente: "Nuvem Pay via Gupy" ou "Recrutamento Nuvem Pay".
  const fromName = cleanCompany(sender.name);
  const platform = detectPlatform(sender);
  if (fromName && (platform === "gupy" || platform === "linkedin" || platform === "outra" || platform === "site_empresa")) {
    // Nome de pessoa (ex.: "Carla Souza") em e-mail da própria empresa: melhor usar o domínio.
    const teamName = /recrutamento|talentos|carreiras|careers|\brh\b|people|vagas|jobs|recursos humanos/i.test(
      sender.name ?? "",
    );
    const looksLikePerson =
      platform === "site_empresa" && !teamName && /^[A-ZÀ-Ý][a-zà-ú]+ [A-ZÀ-Ý][a-zà-ú]+$/.test(fromName);
    if (!looksLikePerson) return fromName;
  }

  // Domínio da empresa: "rh@nuvempay.com.br" → "Nuvempay".
  if (platform === "site_empresa" && sender.domain) {
    const label = sender.domain.split(".").find((part) => !/^(mail|email|rh|jobs|careers|carreiras|vagas|talentos|br|com|net|org)$/.test(part));
    if (label && label.length >= 3) return titleCase(label);
  }
  return null;
}

const ROLE_PATTERNS: RegExp[] = [
  /\bvaga (?:de |para )(?:a |o )?([^\n.!|;:()]{3,80}?)(?= (?:na|no|da empresa|em nossa|em nosso|foi|está|esta)\b|[.!|;:\n]|$)/i,
  /(?:candidatura|inscrição|inscricao|aplicação|aplicacao) (?:para|à|a|na) (?:vaga (?:de )?)?([^\n.!|;:()]{3,80}?)(?= (?:na|no|da empresa|foi|em nossa)\b|[.!|;:\n]|$)/i,
  /posição de ([^\n.!|;:()]{3,80}?)(?= (?:na|no)\b|[.!|;:\n]|$)/i,
];

export function extractRole(subject: string, body: string): string | null {
  const text = `${subject}\n${body}`;
  for (const pattern of ROLE_PATTERNS) {
    const raw = pattern.exec(text)?.[1]?.trim();
    if (!raw) continue;
    const role = raw
      .replace(/^(a|o)\s+/i, "")
      .replace(/\s+e\s+(gostar|quer|inform|agradec|convid|pedimos|vamos|estamos|temos).*$/i, "")
      .replace(/[\s,–-]+$/, "");
    if (role.length >= 3 && role.length <= 80 && !/\b(processo|candidatura|etapa|seletivo)\b/i.test(normalize(role))) {
      return role.charAt(0).toUpperCase() + role.slice(1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Datas ("até 25/10", "dia 3 de novembro", "amanhã", "em até 2 dias")
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function toISO(year: number, month: number, day: number): string | null {
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : null;
}

/** Sem ano informado: usa o ano da mensagem, ou o seguinte se a data já passou. */
function withYear(month: number, day: number, year: number | null, receivedOn: string): string | null {
  const receivedYear = Number(receivedOn.slice(0, 4));
  if (year !== null) return toISO(year < 100 ? 2000 + year : year, month, day);
  const sameYear = toISO(receivedYear, month, day);
  // "05/01" recebido em dezembro é janeiro do ano seguinte; "10/10" recebido em outubro é passado.
  const receivedMonth = Number(receivedOn.slice(5, 7));
  if (sameYear && sameYear < addDaysISO(receivedOn, -7) && receivedMonth >= 10 && month <= 3) {
    return toISO(receivedYear + 1, month, day);
  }
  return sameYear;
}

export function extractDueDate(text: string, receivedOn: string): string | null {
  const normalized = normalize(text);
  const found: { index: number; iso: string }[] = [];

  for (const match of normalized.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const iso = withYear(Number(match[2]), Number(match[1]), match[3] ? Number(match[3]) : null, receivedOn);
    if (iso) found.push({ index: match.index ?? 0, iso });
  }
  const monthNames = Object.keys(MONTHS).join("|");
  for (const match of normalized.matchAll(new RegExp(`\\b(\\d{1,2})(?:o|º)? de (${monthNames})(?: de (\\d{4}))?`, "g"))) {
    const iso = withYear(MONTHS[match[2]], Number(match[1]), match[3] ? Number(match[3]) : null, receivedOn);
    if (iso) found.push({ index: match.index ?? 0, iso });
  }
  const inDays = /em ate (\d{1,2}) dias?/.exec(normalized);
  if (inDays) found.push({ index: inDays.index, iso: addDaysISO(receivedOn, Number(inDays[1])) });
  const tomorrow = /\bamanha\b/.exec(normalized);
  if (tomorrow) found.push({ index: tomorrow.index, iso: addDaysISO(receivedOn, 1) });

  // A primeira data citada que não está no passado.
  const upcoming = found.filter((item) => item.iso >= receivedOn).sort((a, b) => a.index - b.index);
  return upcoming[0]?.iso ?? null;
}

// ---------------------------------------------------------------------------
// Trecho para mostrar na tela
// ---------------------------------------------------------------------------

function buildSnippet(body: string, subject: string): string {
  const flat = body
    .split("\n")
    // Remove citações de respostas anteriores ("> ...").
    .filter((line) => !line.trimStart().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const text = flat || subject;
  return text.length > 400 ? `${text.slice(0, 397).trimEnd()}…` : text;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

const KINDS_WITH_DATES = new Set<InboxKind>([
  "teste",
  "dinamica",
  "entrevista_rh",
  "entrevista_tecnica",
  "proposta",
  "aprovacao",
]);

const TASK_WITH_DATE: Partial<Record<InboxKind, string>> = {
  teste: "Fazer o teste online",
  dinamica: "Dinâmica ou case",
  entrevista_rh: "Entrevista com o RH",
  entrevista_tecnica: "Entrevista técnica",
  proposta: "Responder a proposta",
  aprovacao: "Enviar os documentos pedidos",
};

export function parseMessage(message: IncomingMessage): ParsedMessage {
  const subject = message.subject?.trim() ?? "";
  const body = message.body ?? "";
  const sender = parseSender(message.from);
  const { kind, confidence, relevant } = classify(subject, body);

  const dueDate = KINDS_WITH_DATES.has(kind) ? extractDueDate(`${subject}\n${body}`, message.receivedOn) : null;
  const taskTitle = dueDate ? (TASK_WITH_DATE[kind] ?? KIND_INFO[kind].task) : KIND_INFO[kind].task;

  return {
    relevant,
    kind,
    stage: KIND_INFO[kind].stage,
    confidence,
    company: extractCompany(subject, body, sender),
    roleTitle: extractRole(subject, body),
    platform: detectPlatform(sender),
    taskTitle,
    dueDate,
    snippet: buildSnippet(body, subject),
  };
}

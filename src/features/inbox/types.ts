import type { Platform } from "@/lib/options";
import type { StageKey } from "@/lib/stages";

export const INBOX_KINDS = [
  "confirmacao",
  "teste",
  "dinamica",
  "entrevista_rh",
  "entrevista_tecnica",
  "proposta",
  "aprovacao",
  "reprovacao",
  "outro",
] as const;

export type InboxKind = (typeof INBOX_KINDS)[number];
export type InboxSource = "email" | "colado" | "whatsapp";
export type InboxConfidence = "alta" | "media" | "baixa";
export type InboxStatus = "pendente" | "aplicada" | "ignorada";

/** Como cada tipo de mensagem aparece na tela e para qual etapa ele leva. */
export const KIND_INFO: Record<InboxKind, { label: string; stage: StageKey | null; task: string | null }> = {
  confirmacao: { label: "Candidatura confirmada", stage: "enviada", task: null },
  teste: { label: "Convite para teste", stage: "teste_online", task: "Fazer o teste online" },
  dinamica: { label: "Dinâmica ou case", stage: "dinamica_case", task: "Preparar a dinâmica ou o case" },
  entrevista_rh: { label: "Entrevista com RH", stage: "entrevista_rh", task: "Confirmar a entrevista com o RH" },
  entrevista_tecnica: {
    label: "Entrevista técnica",
    stage: "entrevista_tecnica",
    task: "Preparar a entrevista técnica",
  },
  proposta: { label: "Proposta recebida", stage: "proposta", task: "Responder a proposta" },
  aprovacao: { label: "Aprovação", stage: "aprovada", task: "Enviar os documentos pedidos" },
  reprovacao: { label: "Reprovação", stage: "reprovada", task: null },
  outro: { label: "Mensagem sobre a vaga", stage: null, task: null },
};

/** Resultado da leitura de uma mensagem. */
export type ParsedMessage = {
  /** Fala de um processo seletivo? Alertas de "novas vagas" e afins ficam de fora. */
  relevant: boolean;
  kind: InboxKind;
  stage: StageKey | null;
  confidence: InboxConfidence;
  company: string | null;
  roleTitle: string | null;
  platform: Platform | null;
  taskTitle: string | null;
  dueDate: string | null;
  snippet: string;
};

/** Mensagem de entrada, venha do e-mail ou de um texto colado. */
export type IncomingMessage = {
  subject?: string | null;
  from?: string | null;
  body: string;
  /** Data da mensagem ("AAAA-MM-DD"), usada para entender "até 25/10". */
  receivedOn: string;
};

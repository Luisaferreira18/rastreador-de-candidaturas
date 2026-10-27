/**
 * Dados de exemplo para o app não aparecer vazio em demonstração.
 * Empresas fictícias. As datas são relativas ao dia em que o seed roda,
 * então os prazos e a linha do tempo sempre parecem atuais.
 */

import { addDaysISO } from "@/lib/format";
import type { JobType, Platform, Priority, WorkModel } from "@/lib/options";
import type { StageKey } from "@/lib/stages";
import type { TablesInsert } from "@/types/database";

type SampleApplication = {
  company: string;
  role: string;
  /** Padrão: estágio. */
  jobType?: JobType;
  platform: Platform;
  location: string | null;
  workModel: WorkModel;
  salary: number | null;
  priority: Priority;
  jobUrl?: string;
  notes?: string;
  /** Etapas percorridas, com "há quantos dias" cada mudança aconteceu. */
  path: [StageKey, number][];
  tasks?: { title: string; dueInDays: number | null; done?: boolean }[];
};

const SAMPLES: SampleApplication[] = [
  {
    company: "Banco Aurora",
    role: "Estágio em Engenharia de Software",
    platform: "gupy",
    location: "São Paulo, SP",
    workModel: "hibrido",
    salary: 2200,
    priority: "alta",
    jobUrl: "https://example.com/vagas/banco-aurora-estagio-software",
    notes:
      "Time de pagamentos. Stack: Java, Spring e React.\nRecrutadora: Carla. Gostaram do projeto de API do meu GitHub.",
    path: [["quero_candidatar", 30], ["enviada", 28], ["teste_online", 24], ["dinamica_case", 18], ["entrevista_rh", 12], ["entrevista_tecnica", 4]],
    tasks: [
      { title: "Revisar estruturas de dados e SQL para a entrevista técnica", dueInDays: 2 },
      { title: "Mandar e-mail de agradecimento para a recrutadora", dueInDays: -3, done: true },
    ],
  },
  {
    company: "Nuvem Pay",
    role: "Estágio em Dados",
    platform: "linkedin",
    location: null,
    workModel: "remoto",
    salary: 2500,
    priority: "alta",
    path: [["enviada", 21], ["teste_online", 15], ["entrevista_rh", 6]],
    tasks: [{ title: "Preparar perguntas sobre o time de dados", dueInDays: 1 }],
  },
  {
    company: "Verde Agro Tech",
    role: "Estágio em Desenvolvimento Web",
    platform: "site_empresa",
    location: "Campinas, SP",
    workModel: "presencial",
    salary: 1800,
    priority: "media",
    notes: "Case: criar uma tela de monitoramento de lavouras em React.",
    path: [["enviada", 14], ["dinamica_case", 7]],
    tasks: [{ title: "Entregar o case de front-end", dueInDays: 3 }],
  },
  {
    company: "Lumen Saúde",
    role: "Estágio em Produto",
    platform: "indicacao",
    location: "São Paulo, SP",
    workModel: "hibrido",
    salary: 2000,
    priority: "alta",
    notes: "Indicação do Pedro (veterano). Proposta: bolsa + VR + plano de saúde.",
    path: [["enviada", 35], ["entrevista_rh", 25], ["entrevista_tecnica", 15], ["proposta", 3]],
    tasks: [
      { title: "Responder a proposta", dueInDays: 4 },
      { title: "Comparar benefícios com os outros processos", dueInDays: 0 },
    ],
  },
  {
    company: "Rota Logística",
    role: "Estágio em TI",
    platform: "gupy",
    location: "Barueri, SP",
    workModel: "presencial",
    salary: 1600,
    priority: "baixa",
    notes: "Feedback: buscavam alguém com disponibilidade de 6 horas por dia.",
    path: [["enviada", 40], ["reprovada", 30]],
  },
  {
    company: "Pixel Studio",
    role: "Estágio em Front-end",
    platform: "linkedin",
    location: null,
    workModel: "remoto",
    salary: 1500,
    priority: "media",
    path: [["enviada", 10]],
  },
  {
    company: "Orbital Telecom",
    role: "Estágio em Infraestrutura e Cloud",
    platform: "gupy",
    location: "Rio de Janeiro, RJ",
    workModel: "hibrido",
    salary: 2100,
    priority: "media",
    path: [["enviada", 18], ["teste_online", 12], ["reprovada", 5]],
  },
  {
    company: "Casa Viva Varejo",
    role: "Estágio em Análise de Dados",
    platform: "gupy",
    location: "Belo Horizonte, MG",
    workModel: "hibrido",
    salary: 1700,
    priority: "media",
    path: [["enviada", 9], ["teste_online", 3]],
    tasks: [{ title: "Fazer o teste de lógica e Excel na Gupy", dueInDays: -1 }],
  },
  {
    company: "Atlas Seguros",
    role: "Estágio em QA",
    platform: "site_empresa",
    location: "São Paulo, SP",
    workModel: "presencial",
    salary: 1900,
    priority: "baixa",
    path: [["quero_candidatar", 5]],
    tasks: [{ title: "Ajustar o currículo destacando testes automatizados", dueInDays: 5 }],
  },
  {
    company: "Horizonte Energia",
    role: "Trainee em Tecnologia",
    jobType: "trainee",
    platform: "linkedin",
    location: "Florianópolis, SC",
    workModel: "hibrido",
    salary: 6000,
    priority: "alta",
    path: [["quero_candidatar", 2]],
    tasks: [{ title: "Pedir indicação para a Ana (ex-colega da faculdade)", dueInDays: 1 }],
  },
  {
    company: "Kappa Educação",
    role: "Estágio em Desenvolvimento Mobile",
    platform: "indicacao",
    location: null,
    workModel: "remoto",
    salary: 1800,
    priority: "media",
    notes: "Aprovada! Início previsto para fevereiro. Decidir até o fim do mês se sigo com os outros processos.",
    path: [["enviada", 50], ["entrevista_rh", 42], ["entrevista_tecnica", 35], ["proposta", 28], ["aprovada", 20]],
    tasks: [{ title: "Enviar documentos para o contrato de estágio", dueInDays: -10, done: true }],
  },
  {
    company: "Mar Azul Turismo",
    role: "Suporte de TI (temporada de verão)",
    jobType: "temporario",
    platform: "outra",
    location: "Santos, SP",
    workModel: "presencial",
    salary: 2100,
    priority: "baixa",
    notes: "Desisti: contrato curto e deslocamento longo.",
    path: [["enviada", 45], ["desisti", 38]],
  },
  {
    company: "Quantum Bank",
    role: "Trainee em Segurança da Informação",
    jobType: "trainee",
    platform: "gupy",
    location: "São Paulo, SP",
    workModel: "hibrido",
    salary: 6500,
    priority: "alta",
    notes: "Chegou até a entrevista com RH. Pedir feedback detalhado.",
    path: [["enviada", 26], ["teste_online", 20], ["dinamica_case", 13], ["entrevista_rh", 8], ["reprovada", 2]],
    tasks: [{ title: "Pedir feedback ao recrutador", dueInDays: 6 }],
  },
  {
    company: "Faro Mídia",
    role: "Desenvolvedor(a) Back-end Júnior",
    jobType: "clt",
    platform: "linkedin",
    location: "Curitiba, PR",
    workModel: "remoto",
    salary: 4200,
    priority: "media",
    path: [["enviada", 6]],
  },
  {
    company: "Trilha Mobilidade",
    role: "Estágio em Ciência de Dados",
    platform: "gupy",
    location: "São Paulo, SP",
    workModel: "hibrido",
    salary: 2400,
    priority: "alta",
    path: [["enviada", 16], ["teste_online", 11], ["dinamica_case", 5]],
    tasks: [
      { title: "Apresentar o case de dados (painel de corridas)", dueInDays: 6 },
      { title: "Revisar Python e pandas", dueInDays: -2, done: true },
    ],
  },
  {
    company: "Sol Nascente Alimentos",
    role: "Estágio em TI",
    platform: "site_empresa",
    location: "Ribeirão Preto, SP",
    workModel: "presencial",
    salary: 1400,
    priority: "baixa",
    path: [["enviada", 30]],
  },
  {
    company: "Prisma Consultoria",
    role: "Estágio em Desenvolvimento",
    platform: "linkedin",
    location: "São Paulo, SP",
    workModel: "hibrido",
    salary: 2000,
    priority: "media",
    path: [["quero_candidatar", 1]],
  },
  {
    company: "Ponte Fintech",
    role: "Analista de Dados Júnior",
    jobType: "pj",
    platform: "indicacao",
    location: null,
    workModel: "remoto",
    salary: 5500,
    priority: "alta",
    path: [["enviada", 12], ["entrevista_rh", 7], ["entrevista_tecnica", 2]],
    tasks: [{ title: "Entregar o desafio técnico (SQL + Python)", dueInDays: 3 }],
  },
  {
    company: "Clave Música",
    role: "Estágio em Front-end",
    platform: "gupy",
    location: null,
    workModel: "remoto",
    salary: 1600,
    priority: "baixa",
    path: [["enviada", 60], ["reprovada", 52]],
  },
  {
    company: "Ipê Construtech",
    role: "Estágio em Produto e Dados",
    platform: "gupy",
    location: "Goiânia, GO",
    workModel: "hibrido",
    salary: 1700,
    priority: "media",
    path: [["enviada", 4]],
  },
];

/** Horário fixo (10h em São Paulo) para as mudanças de etapa de exemplo. */
function timestampFor(dateISO: string, offsetMinutes: number): string {
  const minutes = String(offsetMinutes % 60).padStart(2, "0");
  return `${dateISO}T13:${minutes}:00.000Z`;
}

export type SampleDataPlan = {
  applications: (TablesInsert<"applications"> & { id: string })[];
  history: TablesInsert<"stage_history">[];
  tasks: TablesInsert<"tasks">[];
  inbox: TablesInsert<"inbox_items">[];
};

type SampleInboxItem = Omit<TablesInsert<"inbox_items">, "user_id" | "received_at" | "due_date" | "application_id"> & {
  daysAgo: number;
  dueInDays?: number;
  /** Empresa da candidatura já ligada (só para itens resolvidos). */
  linkedCompany?: string;
};

/** Caixa de entrada de exemplo: sugestões para conferir e algumas já resolvidas. */
const SAMPLE_INBOX: SampleInboxItem[] = [
  {
    source: "email",
    external_id: "exemplo-1",
    sender: "Nuvem Pay <noreply@gupy.io>",
    subject: "Próxima etapa: entrevista técnica",
    snippet:
      "Parabéns! Você avançou no processo seletivo da Nuvem Pay. A próxima etapa é uma entrevista técnica com o time de dados. Confirme sua presença pelo link abaixo.",
    kind: "entrevista_tecnica",
    suggested_stage: "entrevista_tecnica",
    confidence: "media",
    company: "Nuvem Pay",
    role_title: "Estágio em Dados",
    platform: "gupy",
    task_title: "Entrevista técnica",
    daysAgo: 0,
    dueInDays: 3,
  },
  {
    source: "colado",
    subject: "Oi! Aqui é a Júlia, do RH da Trilha Mobilidade.",
    snippet:
      "Oi! Aqui é a Júlia, do RH da Trilha Mobilidade. Gostamos muito do seu case! Podemos marcar uma conversa com o RH nesta semana?",
    kind: "entrevista_rh",
    suggested_stage: "entrevista_rh",
    confidence: "media",
    company: "Trilha Mobilidade",
    task_title: "Entrevista com o RH",
    daysAgo: 0,
    dueInDays: 2,
  },
  {
    source: "email",
    external_id: "exemplo-2",
    sender: "Pixel Studio <talentos@pixelstudio.com.br>",
    subject: "Retorno sobre sua candidatura",
    snippet:
      "Olá! Agradecemos seu interesse na vaga de Estágio em Front-end. Infelizmente a vaga foi congelada por tempo indeterminado. Vamos manter seu currículo em nosso banco de talentos.",
    kind: "reprovacao",
    suggested_stage: "reprovada",
    confidence: "media",
    company: "Pixel Studio",
    role_title: "Estágio em Front-end",
    platform: "site_empresa",
    daysAgo: 1,
  },
  {
    // Inequívoca: é aplicada sozinha quando a conta abre o app.
    source: "email",
    external_id: "exemplo-3",
    sender: "LinkedIn <jobs-noreply@linkedin.com>",
    subject: "Sua candidatura foi enviada para Orion Seguros",
    snippet: "Sua candidatura foi enviada para Orion Seguros. Estágio em Dados e BI · São Paulo, SP (híbrido).",
    kind: "confirmacao",
    suggested_stage: "enviada",
    confidence: "alta",
    company: "Orion Seguros",
    role_title: "Estágio em Dados e BI",
    platform: "linkedin",
    daysAgo: 0,
  },
  {
    source: "email",
    external_id: "exemplo-4",
    sender: "Ipê Construtech <noreply@gupy.io>",
    subject: "Recebemos sua candidatura para a vaga de Estágio em Produto e Dados",
    snippet: "Olá! Recebemos sua candidatura para a vaga de Estágio em Produto e Dados na Ipê Construtech.",
    kind: "confirmacao",
    suggested_stage: "enviada",
    confidence: "alta",
    company: "Ipê Construtech",
    role_title: "Estágio em Produto e Dados",
    platform: "gupy",
    status: "aplicada",
    auto_applied: true,
    resolution: "Ipê Construtech adicionada em Candidatura enviada",
    linkedCompany: "Ipê Construtech",
    daysAgo: 4,
  },
  {
    source: "email",
    external_id: "exemplo-5",
    sender: "Recrutamento Quantum Bank <talentos@quantumbank.com.br>",
    subject: "Atualização sobre o processo seletivo",
    snippet:
      "Agradecemos sua participação no processo seletivo. Infelizmente, optamos por seguir com outros candidatos neste momento.",
    kind: "reprovacao",
    suggested_stage: "reprovada",
    confidence: "alta",
    company: "Quantum Bank",
    platform: "site_empresa",
    status: "aplicada",
    auto_applied: true,
    resolution: "Quantum Bank → Reprovada",
    linkedCompany: "Quantum Bank",
    daysAgo: 2,
  },
];

/** Monta as linhas a inserir, com ids gerados aqui para ligar histórico e tarefas. */
export function buildSampleData(userId: string, today: string, newId: () => string): SampleDataPlan {
  const plan: SampleDataPlan = { applications: [], history: [], tasks: [], inbox: [] };
  const positionInStage = new Map<StageKey, number>();

  SAMPLES.forEach((sample, sampleIndex) => {
    const id = newId();
    const steps = sample.path.map(([stage, daysAgo], stepIndex) => ({
      stage,
      changedAt: timestampFor(addDaysISO(today, -daysAgo), sampleIndex + stepIndex),
      date: addDaysISO(today, -daysAgo),
    }));
    const last = steps[steps.length - 1];
    const sentStep = steps.find((step) => step.stage === "enviada");

    const position = positionInStage.get(last.stage) ?? 0;
    positionInStage.set(last.stage, position + 1024);

    plan.applications.push({
      id,
      user_id: userId,
      company: sample.company,
      role_title: sample.role,
      job_type: sample.jobType ?? "estagio",
      job_url: sample.jobUrl ?? null,
      platform: sample.platform,
      location: sample.location,
      work_model: sample.workModel,
      salary_cents: sample.salary === null ? null : sample.salary * 100,
      applied_at: sentStep?.date ?? null,
      stage: last.stage,
      priority: sample.priority,
      notes: sample.notes ?? null,
      position,
      stage_changed_at: last.changedAt,
      created_at: steps[0].changedAt,
    });

    steps.forEach((step, stepIndex) => {
      plan.history.push({
        application_id: id,
        user_id: userId,
        from_stage: stepIndex === 0 ? null : steps[stepIndex - 1].stage,
        to_stage: step.stage,
        changed_at: step.changedAt,
      });
    });

    for (const task of sample.tasks ?? []) {
      plan.tasks.push({
        application_id: id,
        user_id: userId,
        title: task.title,
        due_date: task.dueInDays === null ? null : addDaysISO(today, task.dueInDays),
        done: task.done ?? false,
      });
    }
  });

  SAMPLE_INBOX.forEach(({ daysAgo, dueInDays, linkedCompany, ...item }, index) => {
    const receivedAt = timestampFor(addDaysISO(today, -daysAgo), 30 + index);
    const linked = linkedCompany ? plan.applications.find((application) => application.company === linkedCompany) : null;
    plan.inbox.push({
      ...item,
      // Id único por carga: dá para carregar os exemplos mais de uma vez sem conflito.
      external_id: item.external_id ? `${item.external_id}-${newId().slice(-8)}` : null,
      user_id: userId,
      received_at: receivedAt,
      due_date: dueInDays === undefined ? null : addDaysISO(today, dueInDays),
      application_id: linked?.id ?? null,
      resolved_at: item.status === "aplicada" ? receivedAt : null,
    });
  });

  return plan;
}

/**
 * Concursos de exemplo da conta demo. Órgãos fictícios e links de exemplo
 * (example.com): nada aqui leva a uma inscrição de verdade. As datas são
 * relativas ao dia do seed, então a contagem até a prova e os alertas de
 * inscrição e boleto sempre parecem atuais.
 */

import type { ConcursoProfileCriteria } from "@/features/concursos/search/profile";
import type { CatalogNotice } from "@/features/concursos/search/types";
import type { DateKind, EducationLevel, Sphere } from "@/lib/concurso-options";
import type { ConcursoStageKey } from "@/lib/concurso-stages";
import { addDaysISO } from "@/lib/format";
import type { Priority } from "@/lib/options";
import type { TablesInsert } from "@/types/database";

type SampleConcurso = {
  organ: string;
  role: string;
  examBoard: string | null;
  sphere: Sphere;
  education: EducationLevel;
  area: string | null;
  /** Em reais. */
  salary: number | null;
  vacancies: number | null;
  reserveList: boolean;
  city: string | null;
  state: string | null;
  slug: string;
  notes?: string;
  priority: Priority;
  /** Etapas percorridas, com "há quantos dias" cada mudança aconteceu. */
  path: [ConcursoStageKey, number][];
  dates: { kind: DateKind; inDays: number; time?: string; note?: string }[];
  subjects?: { name: string; weight?: number; questions?: number; status: "nao_estudado" | "estudado" | "revisado" }[];
  tasks?: { title: string; dueInDays: number | null; done?: boolean }[];
};

const SAMPLES: SampleConcurso[] = [
  {
    organ: "Agência Nacional de Dados",
    role: "Analista em Tecnologia da Informação",
    examBoard: "Cebraspe",
    sphere: "federal",
    education: "superior",
    area: "TI",
    salary: 10500,
    vacancies: 30,
    reserveList: true,
    city: "Brasília",
    state: "DF",
    slug: "agencia-nacional-de-dados",
    notes: "Edital nº 1/2026. Prova nas capitais: escolhi fazer em São Paulo.\nCaderno de questões no estilo certo/errado: cada erro anula um acerto.",
    priority: "alta",
    path: [["acompanhando", 45], ["edital_publicado", 32], ["inscricao_feita", 14], ["taxa_paga", 12]],
    dates: [
      { kind: "inscricao_inicio", inDays: -30 },
      { kind: "inscricao_fim", inDays: -9 },
      { kind: "boleto", inDays: -8 },
      { kind: "prova", inDays: 24, time: "08:00", note: "Objetiva e discursiva" },
      { kind: "gabarito", inDays: 26 },
      { kind: "resultado", inDays: 70 },
    ],
    subjects: [
      { name: "Língua Portuguesa", questions: 20, status: "revisado" },
      { name: "Raciocínio Lógico", questions: 10, status: "estudado" },
      { name: "Legislação aplicada", questions: 10, status: "estudado" },
      { name: "Banco de Dados", weight: 2, questions: 20, status: "estudado" },
      { name: "Engenharia de Software", weight: 2, questions: 15, status: "nao_estudado" },
      { name: "Segurança da Informação", weight: 2, questions: 15, status: "nao_estudado" },
      { name: "Ciência de Dados", weight: 2, questions: 10, status: "nao_estudado" },
    ],
    tasks: [
      { title: "Revisar SQL e modelagem de dados", dueInDays: 3 },
      { title: "Fazer um simulado completo no estilo Cebraspe", dueInDays: 6 },
      { title: "Imprimir o cartão de confirmação", dueInDays: 20 },
      { title: "Pagar a taxa de inscrição", dueInDays: -8, done: true },
    ],
  },
  {
    organ: "Prefeitura de Vale do Ipê",
    role: "Técnico em Informática",
    examBoard: "Vunesp",
    sphere: "municipal",
    education: "tecnico",
    area: "TI",
    salary: 3480,
    vacancies: 4,
    reserveList: true,
    city: "Vale do Ipê",
    state: "SP",
    slug: "prefeitura-vale-do-ipe",
    notes: "Taxa de R$ 75,00. Jornada de 40 horas, no Departamento de TI da prefeitura.",
    priority: "media",
    path: [["acompanhando", 16], ["edital_publicado", 10]],
    dates: [
      { kind: "inscricao_inicio", inDays: -10 },
      { kind: "isencao", inDays: -5 },
      { kind: "inscricao_fim", inDays: 3, time: "23:59" },
      { kind: "boleto", inDays: 4 },
      { kind: "prova", inDays: 38, note: "O horário sai no edital de convocação" },
    ],
    subjects: [
      { name: "Língua Portuguesa", questions: 15, status: "nao_estudado" },
      { name: "Matemática", questions: 10, status: "nao_estudado" },
      { name: "Conhecimentos Específicos", questions: 25, status: "nao_estudado" },
    ],
    tasks: [{ title: "Fazer a inscrição no site da banca", dueInDays: 2 }],
  },
  {
    organ: "Universidade Federal do Planalto",
    role: "Assistente em Administração",
    examBoard: null,
    sphere: "federal",
    education: "medio",
    area: "Administrativa",
    salary: 4556,
    vacancies: 12,
    reserveList: true,
    city: "Anápolis",
    state: "GO",
    slug: "universidade-federal-do-planalto",
    notes: "Concurso autorizado. O edital deve sair em novembro; a própria universidade organiza.",
    priority: "baixa",
    path: [["acompanhando", 6]],
    dates: [{ kind: "inscricao_inicio", inDays: 12, note: "Data prevista no cronograma da universidade" }],
  },
  {
    organ: "Câmara Municipal de Serra Clara",
    role: "Analista Legislativo: Informática",
    examBoard: "FGV",
    sphere: "municipal",
    education: "superior",
    area: "TI",
    salary: 7900,
    vacancies: 2,
    reserveList: true,
    city: "Serra Clara",
    state: "MG",
    slug: "camara-serra-clara",
    notes: "Pelo gabarito preliminar, 68 acertos em 80. Corte do ano passado: 64.",
    priority: "alta",
    path: [["acompanhando", 85], ["edital_publicado", 72], ["inscricao_feita", 58], ["taxa_paga", 56], ["prova_marcada", 22], ["prova_feita", 9]],
    dates: [
      { kind: "inscricao_fim", inDays: -57 },
      { kind: "prova", inDays: -9, time: "13:00" },
      { kind: "gabarito", inDays: -7 },
      { kind: "recurso", inDays: -5, note: "Dois dias úteis" },
      { kind: "resultado", inDays: 16 },
    ],
    subjects: [
      { name: "Língua Portuguesa", questions: 20, status: "revisado" },
      { name: "Regimento Interno", questions: 10, status: "revisado" },
      { name: "Redes e Infraestrutura", questions: 25, status: "revisado" },
      { name: "Desenvolvimento de Sistemas", questions: 25, status: "estudado" },
    ],
    tasks: [{ title: "Conferir o gabarito definitivo", dueInDays: 4 }],
  },
  {
    organ: "Companhia de Saneamento do Vale",
    role: "Analista de Sistemas",
    examBoard: "Fundep",
    sphere: "estadual",
    education: "superior",
    area: "TI",
    salary: 6200,
    vacancies: 5,
    reserveList: false,
    city: "Belo Horizonte",
    state: "MG",
    slug: "saneamento-do-vale",
    notes: "Fiquei a 4 questões do corte. A banca cobrou bastante legislação estadual: estudar mais na próxima.",
    priority: "media",
    path: [["edital_publicado", 120], ["inscricao_feita", 105], ["taxa_paga", 104], ["prova_feita", 62], ["resultado", 41], ["sem_aprovacao", 41]],
    dates: [
      { kind: "prova", inDays: -62, time: "09:00" },
      { kind: "resultado", inDays: -41 },
    ],
  },
];

/** Editais fictícios do catálogo (fonte "exemplo"), sugeridos à conta demo. A busca de verdade os ignora. */
const SAMPLE_NOTICES: (Omit<CatalogNotice, "source" | "dates" | "publishedAt"> & {
  publishedDaysAgo: number;
  dates: { kind: DateKind; inDays: number; time?: string }[];
})[] = [
  {
    externalId: "exemplo-tribunal-contas-planalto",
    organ: "Tribunal de Contas do Planalto",
    title: "Edital nº 2/2026: Analista de Controle Externo",
    roles: [{ title: "Analista de Controle Externo: Tecnologia da Informação", education: "superior" }],
    examBoard: "Cebraspe",
    sphere: "estadual",
    salaryCents: 1_230_000,
    vacancies: 8,
    reserveList: true,
    city: "Anápolis",
    state: "GO",
    noticeUrl: "https://example.com/concursos/tribunal-de-contas-do-planalto/edital.pdf",
    registrationUrl: "https://example.com/concursos/tribunal-de-contas-do-planalto/inscricao",
    publishedDaysAgo: 3,
    dates: [
      { kind: "inscricao_inicio", inDays: -1 },
      { kind: "inscricao_fim", inDays: 18 },
      { kind: "prova", inDays: 60, time: "08:00" },
    ],
    excerpt: "Edital fictício da conta de demonstração.",
  },
  {
    externalId: "exemplo-prefeitura-lagoa-serena",
    organ: "Prefeitura de Lagoa Serena",
    title: "Concurso Público nº 1/2026",
    roles: [
      { title: "Analista de Sistemas", education: "superior" },
      { title: "Agente Administrativo", education: "medio" },
    ],
    examBoard: "Vunesp",
    sphere: "municipal",
    salaryCents: 590_000,
    vacancies: 3,
    reserveList: true,
    city: "Lagoa Serena",
    state: "SP",
    noticeUrl: "https://example.com/concursos/prefeitura-de-lagoa-serena/edital.pdf",
    registrationUrl: "https://example.com/concursos/prefeitura-de-lagoa-serena/inscricao",
    publishedDaysAgo: 12,
    dates: [
      { kind: "inscricao_inicio", inDays: -12 },
      { kind: "inscricao_fim", inDays: 2 },
      { kind: "boleto", inDays: 3 },
      { kind: "prova", inDays: 33 },
    ],
    excerpt: "Edital fictício da conta de demonstração.",
  },
  {
    externalId: "exemplo-instituto-federal-cerrado",
    organ: "Instituto Federal do Cerrado",
    title: "Edital nº 14/2026: técnico-administrativos",
    roles: [{ title: "Técnico de Tecnologia da Informação", education: "tecnico" }],
    examBoard: null,
    sphere: "federal",
    salaryCents: 455_600,
    vacancies: 6,
    reserveList: true,
    city: null,
    state: null,
    noticeUrl: "https://example.com/concursos/instituto-federal-do-cerrado/edital.pdf",
    registrationUrl: null,
    publishedDaysAgo: 1,
    dates: [
      { kind: "inscricao_inicio", inDays: 2 },
      { kind: "inscricao_fim", inDays: 30 },
      { kind: "prova", inDays: 75 },
    ],
    excerpt: "Edital fictício da conta de demonstração.",
  },
];

/** Perfil de concursos da conta demo (combina com o currículo fictício de TI e dados). */
export const DEMO_CONCURSO_PROFILE: ConcursoProfileCriteria &
  Pick<TablesInsert<"concurso_profiles">, "auto_search" | "last_run_at" | "last_run_stats"> = {
  education: "superior",
  areas: ["TI", "dados"],
  roles: ["Analista", "Técnico"],
  spheres: ["federal", "estadual", "municipal"],
  cities: ["São Paulo/SP", "Campinas/SP"],
  states: ["SP"],
  min_salary_cents: 400_000,
  exam_boards: ["Cebraspe", "FGV", "Vunesp"],
  accepts_relocation: true,
  auto_search: true,
  last_run_at: null,
  last_run_stats: null,
};

export function sampleNotices(today: string): CatalogNotice[] {
  return SAMPLE_NOTICES.map(({ publishedDaysAgo, dates, ...notice }) => ({
    ...notice,
    source: "exemplo",
    publishedAt: addDaysISO(today, -publishedDaysAgo),
    dates: dates.map((item) => ({ kind: item.kind, date: addDaysISO(today, item.inDays), time: item.time ?? null, note: null })),
  }));
}

/** Horário fixo (10h em São Paulo) para as mudanças de etapa de exemplo. */
function timestampFor(dateISO: string, offsetMinutes: number): string {
  const minutes = String(offsetMinutes % 60).padStart(2, "0");
  return `${dateISO}T13:${minutes}:00.000Z`;
}

export type SampleConcursosPlan = {
  concursos: (TablesInsert<"concursos"> & { id: string })[];
  history: TablesInsert<"concurso_stage_history">[];
  dates: TablesInsert<"concurso_dates">[];
  subjects: TablesInsert<"concurso_subjects">[];
  tasks: TablesInsert<"tasks">[];
};

/** Monta as linhas a inserir, com ids gerados aqui para ligar histórico, cronograma, matérias e tarefas. */
export function buildSampleConcursos(userId: string, today: string, newId: () => string): SampleConcursosPlan {
  const plan: SampleConcursosPlan = { concursos: [], history: [], dates: [], subjects: [], tasks: [] };
  const positionInStage = new Map<ConcursoStageKey, number>();

  SAMPLES.forEach((sample, sampleIndex) => {
    const id = newId();
    const steps = sample.path.map(([stage, daysAgo], stepIndex) => ({
      stage,
      changedAt: timestampFor(addDaysISO(today, -daysAgo), 40 + sampleIndex + stepIndex),
    }));
    const last = steps[steps.length - 1];
    const position = positionInStage.get(last.stage) ?? 0;
    positionInStage.set(last.stage, position + 1024);

    plan.concursos.push({
      id,
      user_id: userId,
      organ: sample.organ,
      role_title: sample.role,
      exam_board: sample.examBoard,
      sphere: sample.sphere,
      education: sample.education,
      area: sample.area,
      salary_cents: sample.salary === null ? null : sample.salary * 100,
      vacancies: sample.vacancies,
      reserve_list: sample.reserveList,
      city: sample.city,
      state: sample.state,
      notice_url: `https://example.com/concursos/${sample.slug}/edital.pdf`,
      registration_url: sample.dates.some((item) => item.kind === "inscricao_fim")
        ? `https://example.com/concursos/${sample.slug}/inscricao`
        : null,
      notes: sample.notes ?? null,
      priority: sample.priority,
      stage: last.stage,
      position,
      stage_changed_at: last.changedAt,
      created_at: steps[0].changedAt,
    });

    steps.forEach((step, stepIndex) => {
      plan.history.push({
        concurso_id: id,
        user_id: userId,
        from_stage: stepIndex === 0 ? null : steps[stepIndex - 1].stage,
        to_stage: step.stage,
        changed_at: step.changedAt,
      });
    });

    for (const item of sample.dates) {
      plan.dates.push({
        concurso_id: id,
        user_id: userId,
        kind: item.kind,
        date: addDaysISO(today, item.inDays),
        time: item.time ?? null,
        note: item.note ?? null,
      });
    }

    (sample.subjects ?? []).forEach((subject, index) => {
      plan.subjects.push({
        concurso_id: id,
        user_id: userId,
        name: subject.name,
        weight: subject.weight ?? null,
        questions: subject.questions ?? null,
        status: subject.status,
        position: index * 1024,
      });
    });

    for (const task of sample.tasks ?? []) {
      plan.tasks.push({
        concurso_id: id,
        user_id: userId,
        title: task.title,
        due_date: task.dueInDays === null ? null : addDaysISO(today, task.dueInDays),
        done: task.done ?? false,
      });
    }
  });

  return plan;
}

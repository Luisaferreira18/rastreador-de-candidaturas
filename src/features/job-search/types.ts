import type { ResumeLanguage } from "@/features/resume/extract";
import type { JobType, WorkModel } from "@/lib/options";

/** De onde a vaga veio. */
export type JobSource = "gupy" | "greenhouse" | "lever";
export type LeadStatus = "nova" | "adicionada" | "descartada";

export const SOURCE_LABELS: Record<JobSource, string> = {
  gupy: "Gupy",
  greenhouse: "Greenhouse",
  lever: "Lever",
};

/** Página de vagas de uma empresa no Greenhouse ou no Lever. */
export type BoardRef = { source: "greenhouse" | "lever"; slug: string; company?: string };

/** Uma vaga já convertida para o mesmo formato, venha de onde vier. */
export type ScrapedJob = {
  source: JobSource;
  externalId: string;
  company: string;
  title: string;
  url: string;
  /** Texto do local como aparece na fonte ("São Paulo, SP", "Remoto"). */
  location: string | null;
  /** Sigla do estado, quando a fonte informa de forma estruturada. */
  state: string | null;
  city: string | null;
  workModel: WorkModel | null;
  /** Tipo informado pela fonte (a Gupy informa; nas outras é deduzido do título). */
  jobType: JobType | null;
  /** Vaga que não está no nosso conjunto de tipos (jovem aprendiz, banco de talentos...). */
  otherType: string | null;
  /** País, quando a fonte informa ("BR"). */
  country: string | null;
  salaryCents: number | null;
  publishedAt: string | null;
  /** Data limite (AAAA-MM-DD), quando informada. */
  deadline: string | null;
  /** Benefícios citados na descrição ("Vale-transporte", "Plano de saúde"). */
  benefits: string[];
  /** Jornada citada na descrição ("6h por dia"). */
  workload: string | null;
  /** Onde baixar a descrição, quando a listagem não traz (Greenhouse). */
  detailUrl: string | null;
  /** Descrição e categorias, para procurar as palavras-chave do currículo. */
  text: string;
};

/** O perfil já no formato usado pela busca (vem da tabela job_profiles). */
export type SearchProfile = {
  roles: string[];
  keywords: string[];
  excludedWords: string[];
  city: string | null;
  state: string | null;
  workModels: WorkModel[];
  jobTypes: JobType[];
  minSalaryCents: number | null;
  useGupy: boolean;
  useCompanyBoards: boolean;
  extraBoards: BoardRef[];
  /** Habilidades do currículo (somam com as palavras-chave). */
  resumeSkills: string[];
  /** Idiomas do currículo, ou null sem currículo (aí não há aviso de idioma). */
  resumeLanguages: ResumeLanguage[] | null;
};

/** Resultado da nota de compatibilidade de uma vaga. */
export type JobMatch =
  | { excluded: true; reason: string }
  | { excluded: false; score: number; reasons: string[]; warnings: string[] };

export type ScoredJob = ScrapedJob & { score: number; reasons: string[]; warnings: string[] };

/** Resumo de uma busca, guardado no perfil e mostrado na tela. */
export type SearchStats = {
  /** Vagas baixadas das fontes. */
  analyzed: number;
  /** Compatíveis com o perfil (inclusive as já sugeridas antes). */
  matched: number;
  /** Novas sugestões gravadas nesta busca. */
  added: number;
  sources: number;
  /** Fontes que falharam ("Gupy: não respondeu a tempo"). */
  errors: string[];
  finishedAt: string;
};

/** Resposta de POST /api/vagas/buscar. */
export type SearchResponse =
  | { status: "ok"; stats: SearchStats }
  | { status: "sem-perfil" }
  | { status: "desligada" }
  | { status: "recente" }
  | { status: "em-andamento" }
  | { status: "erro"; message: string };

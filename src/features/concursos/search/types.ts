import type { DateKind, EducationLevel, Sphere } from "@/lib/concurso-options";

export type NoticeSource = "dou" | "querido_diario";

export const SOURCE_LABELS: Record<NoticeSource, string> = {
  dou: "Diário Oficial da União",
  querido_diario: "Diário oficial do município (Querido Diário)",
};

export type NoticeRole = { title: string; education: EducationLevel | null };
export type NoticeScheduleDate = { kind: DateKind; date: string; time: string | null; note: string | null };

/** Um edital encontrado, no formato do catálogo (tabela concurso_notices). */
export type CatalogNotice = {
  source: NoticeSource;
  externalId: string;
  organ: string;
  title: string | null;
  roles: NoticeRole[];
  examBoard: string | null;
  sphere: Sphere | null;
  salaryCents: number | null;
  vacancies: number | null;
  reserveList: boolean;
  city: string | null;
  state: string | null;
  noticeUrl: string;
  registrationUrl: string | null;
  publishedAt: string | null;
  dates: NoticeScheduleDate[];
  excerpt: string | null;
};

/** O perfil de concursos no formato usado pela nota. */
export type ConcursoSearchProfile = {
  education: EducationLevel;
  areas: string[];
  roles: string[];
  spheres: Sphere[];
  /** "Belo Horizonte/MG" */
  cities: string[];
  states: string[];
  minSalaryCents: number | null;
  examBoards: string[];
  acceptsRelocation: boolean;
};

export type NoticeMatch =
  | { excluded: true; reason: string }
  | { excluded: false; score: number; role: string | null; reasons: string[]; warnings: string[] };

/** Cobertura do Querido Diário para cada cidade do perfil (mostrada na página do perfil). */
export type CityCoverage = {
  place: string;
  status: "em-dia" | "parado" | "sem-diarios" | "nao-encontrada";
  lastDate: string | null;
};

/** Resumo de uma busca, guardado no perfil e mostrado na tela. */
export type ConcursoSearchStats = {
  /** Editais olhados no catálogo. */
  analyzed: number;
  matched: number;
  added: number;
  /** Fontes que falharam ("Querido Diário: não respondeu a tempo"). */
  errors: string[];
  coverage: CityCoverage[];
  /** Sem a chave secreta, o catálogo não é atualizado na hora (só pelo cron). */
  catalogUpdated: boolean;
  finishedAt: string;
};

/** Resposta de POST /api/concursos/buscar. */
export type ConcursoSearchResponse =
  | { status: "ok"; stats: ConcursoSearchStats }
  | { status: "sem-perfil" }
  | { status: "desligada" }
  | { status: "recente" }
  | { status: "erro"; message: string };

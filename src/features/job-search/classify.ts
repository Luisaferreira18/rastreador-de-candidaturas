/**
 * Deduz do texto da vaga o que as fontes nem sempre informam:
 * tipo de contrato, nível de senioridade e modelo de trabalho.
 */

import type { JobType, WorkModel } from "@/lib/options";
import { fold } from "./text";

/** Tipo de vaga pelo título ou pelo "commitment" do Lever. Desconhecido = null. */
export function detectJobType(text: string): JobType | null {
  const value = fold(text);
  // "Internal Audit" não é estágio: só "intern" e "internship" como palavra inteira.
  if (/\bestagi(o|ario|aria|arios|arias|ario\(a\)|ario\/a)\b|\bintern(ship|s)?\b|\bestudante\b/.test(value)) return "estagio";
  if (/\btrainee\b/.test(value)) return "trainee";
  if (/\bpj\b|pessoa juridica|\bcontractor\b/.test(value)) return "pj";
  if (/\btemporari[oa]\b|\btemporary\b/.test(value)) return "temporario";
  if (/\bfreela(ncer)?\b|\bfreelance\b/.test(value)) return "freela";
  if (/\bclt\b|\befetiv[oa]\b/.test(value)) return "clt";
  return null;
}

/** Tipos que não estão no app e não devem virar sugestão para quem procura estágio. */
export function detectOtherType(text: string): string | null {
  const value = fold(text);
  if (/\b(jovem )?aprendiz\b|\bapprentice\b/.test(value)) return "Jovem aprendiz";
  if (/\bbanco de talentos\b|\btalent pool\b/.test(value)) return "Banco de talentos";
  return null;
}

export type Seniority = "junior" | "pleno" | "senior" | "lideranca" | null;

/** Nível pelo título ("Analista Sênior", "Engineer III", "Coordenador"). */
export function detectSeniority(title: string): Seniority {
  const value = fold(title);
  if (/\b(coordenador|coordenadora|coordinator|gerente|manager|head|diretor|diretora|director|vp|lider|lead|supervisor|supervisora|chief)\b/.test(value)) {
    return "lideranca";
  }
  if (/\b(senior|sr|especialista|specialist|staff|principal|expert)\b|\b(iii|iv)\b/.test(value)) return "senior";
  if (/\b(pleno|pl|mid)\b|\bii\b/.test(value)) return "pleno";
  if (/\b(junior|jr|entry)\b|\bi\b/.test(value)) return "junior";
  return null;
}

/** Modelo de trabalho pelo título ou pelo local ("Híbrido/SP", "Remote - Brazil"). */
export function detectWorkModel(text: string): WorkModel | null {
  const value = fold(text);
  if (/\bh[iy]brid[oa]?\b|\bhybrid\b/.test(value)) return "hibrido";
  if (/\bremot[oa]\b|\bremote\b|\bhome ?office\b|\banywhere\b|\bteletrabalho\b/.test(value)) return "remoto";
  if (/\bpresencial\b|\bon-?site\b|\bin-?office\b|\bonsite\b/.test(value)) return "presencial";
  return null;
}

/** Valores de tipo de vaga da Gupy. */
const GUPY_TYPES: Record<string, JobType> = {
  vacancy_type_internship: "estagio",
  vacancy_type_trainee: "trainee",
  vacancy_type_effective: "clt",
  vacancy_legal_entity: "pj",
  vacancy_type_temporary: "temporario",
  vacancy_type_freelancer: "freela",
  vacancy_type_autonomous: "freela",
};

const GUPY_OTHER_TYPES: Record<string, string> = {
  vacancy_type_apprentice: "Jovem aprendiz",
  vacancy_type_talent_pool: "Banco de talentos",
  vacancy_type_associate: "Associado",
  vacancy_type_lecturer: "Docente",
  vacancy_type_volunteer: "Voluntário",
  vacancy_type_summer: "Temporada de verão",
  vacancy_type_parter: "Parceiro",
};

export function gupyJobType(type: string | null | undefined): { jobType: JobType | null; otherType: string | null } {
  if (!type) return { jobType: null, otherType: null };
  if (GUPY_TYPES[type]) return { jobType: GUPY_TYPES[type], otherType: null };
  return { jobType: null, otherType: GUPY_OTHER_TYPES[type] ?? "Outro tipo" };
}

/** Para filtrar a busca da Gupy pelos tipos do perfil. */
export function gupyTypesFor(jobTypes: readonly JobType[]): string[] {
  return Object.entries(GUPY_TYPES)
    .filter(([, jobType]) => jobTypes.includes(jobType))
    .map(([gupyType]) => gupyType);
}

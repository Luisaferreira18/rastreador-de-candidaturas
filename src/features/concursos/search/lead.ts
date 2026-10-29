import { topPosition } from "@/features/board/board-state";
import type { Tables, TablesInsert } from "@/types/database";
import { rowToNotice } from "./rows";
import { SOURCE_LABELS } from "./types";

export type ConcursoLead = Tables<"concurso_leads">;
export type ConcursoNoticeRow = Tables<"concurso_notices">;
export type ConcursoLeadWithNotice = ConcursoLead & { notice: ConcursoNoticeRow };

/**
 * Concurso criado pelo botão "Acompanhar", já com o cronograma do edital.
 * Etapa "Edital publicado": o edital saiu, a inscrição ainda não foi feita.
 */
export function leadToConcurso(
  lead: ConcursoLead,
  row: ConcursoNoticeRow,
): { concurso: Omit<TablesInsert<"concursos">, "user_id">; dates: Omit<TablesInsert<"concurso_dates">, "user_id" | "concurso_id">[] } {
  const notice = rowToNotice(row);
  const role = notice.roles.find((item) => item.title === lead.role) ?? notice.roles[0] ?? null;
  const notes = [
    `Encontrado pelo caça-concursos (${lead.score}% compatível, ${SOURCE_LABELS[notice.source]}).`,
    lead.reasons.length > 0 ? `Por quê: ${lead.reasons.join(" · ")}.` : null,
    notice.title ? `Edital: ${notice.title}.` : null,
    "Confira tudo no edital oficial. O app nunca faz a inscrição por você.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    concurso: {
      organ: notice.organ.slice(0, 160),
      role_title: (lead.role ?? role?.title ?? notice.title ?? "Cargo a confirmar").slice(0, 160),
      exam_board: notice.examBoard,
      sphere: notice.sphere ?? "federal",
      education: role?.education ?? "superior",
      salary_cents: notice.salaryCents,
      vacancies: notice.vacancies,
      reserve_list: notice.reserveList,
      city: notice.city,
      state: notice.state,
      notice_url: notice.noticeUrl,
      registration_url: notice.registrationUrl,
      stage: "edital_publicado",
      priority: lead.score >= 80 ? "alta" : "media",
      notes,
      position: topPosition(),
    },
    dates: notice.dates.slice(0, 30).map((item) => ({
      kind: item.kind,
      date: item.date,
      time: item.time,
      note: item.note?.slice(0, 200) ?? null,
    })),
  };
}

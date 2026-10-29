/** Conversões entre o edital no formato da busca e a linha da tabela concurso_notices. */

import type { Json, Tables, TablesInsert } from "@/types/database";
import type { CatalogNotice, NoticeRole, NoticeScheduleDate } from "./types";

type NoticeRow = Tables<"concurso_notices">;

export function noticeToRow(notice: CatalogNotice): TablesInsert<"concurso_notices"> {
  return {
    source: notice.source,
    external_id: notice.externalId,
    organ: notice.organ,
    title: notice.title,
    roles: notice.roles as unknown as Json,
    exam_board: notice.examBoard,
    sphere: notice.sphere,
    salary_cents: notice.salaryCents,
    vacancies: notice.vacancies,
    reserve_list: notice.reserveList,
    city: notice.city?.slice(0, 120) ?? null,
    state: notice.state,
    notice_url: notice.noticeUrl,
    registration_url: notice.registrationUrl,
    published_at: notice.publishedAt,
    dates: notice.dates as unknown as Json,
    excerpt: notice.excerpt?.slice(0, 2000) ?? null,
  };
}

/** Linha do catálogo de volta para o formato usado pela nota. */
export function rowToNotice(row: Pick<NoticeRow, Exclude<keyof NoticeRow, "id" | "found_at">>): CatalogNotice {
  return {
    source: row.source,
    externalId: row.external_id,
    organ: row.organ,
    title: row.title,
    roles: Array.isArray(row.roles) ? (row.roles as unknown as NoticeRole[]) : [],
    examBoard: row.exam_board,
    sphere: row.sphere,
    salaryCents: row.salary_cents,
    vacancies: row.vacancies,
    reserveList: row.reserve_list,
    city: row.city,
    state: row.state,
    noticeUrl: row.notice_url,
    registrationUrl: row.registration_url,
    publishedAt: row.published_at,
    dates: Array.isArray(row.dates) ? (row.dates as unknown as NoticeScheduleDate[]) : [],
    excerpt: row.excerpt,
  };
}

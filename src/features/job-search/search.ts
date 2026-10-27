/**
 * A busca em si: monta as consultas do perfil, baixa as fontes, dá a nota e
 * escolhe as vagas novas. As funções recebem o `fetchJson` de fora, então os
 * testes rodam sem internet.
 */

import { companyKey } from "@/features/inbox/plan";
import { COMPANY_BOARDS, boardKey } from "./boards";
import { MIN_SCORE, scoreJob } from "./score";
import { boardApiUrl, parseBoardResponse } from "./sources/boards";
import { gupyQueryUrls, parseGupyResponse } from "./sources/gupy";
import { mapLimit, SourceError, type FetchJson } from "./sources/http";
import { fold } from "./text";
import type { BoardRef, ScoredJob, ScrapedJob, SearchProfile } from "./types";

/** No máximo esta quantidade de vagas novas por busca (as de nota mais alta). */
export const MAX_NEW_PER_RUN = 30;
/** Downloads simultâneos. */
const CONCURRENCY = 6;

export type SourceTask = { key: string; label: string; url: string; parse: (json: unknown) => ScrapedJob[] };

function boardLabel(board: BoardRef): string {
  return board.company ?? `${board.slug} (${board.source === "greenhouse" ? "Greenhouse" : "Lever"})`;
}

export function tasksForProfile(profile: SearchProfile): SourceTask[] {
  const tasks: SourceTask[] = [];
  if (profile.useGupy) {
    for (const url of gupyQueryUrls(profile)) tasks.push({ key: url, label: "Gupy", url, parse: parseGupyResponse });
  }
  const boards = new Map<string, BoardRef>();
  if (profile.useCompanyBoards) for (const board of COMPANY_BOARDS) boards.set(boardKey(board), board);
  for (const board of profile.extraBoards) {
    if (!boards.has(boardKey(board))) boards.set(boardKey(board), board);
  }
  for (const [key, board] of boards) {
    tasks.push({ key, label: boardLabel(board), url: boardApiUrl(board), parse: (json) => parseBoardResponse(json, board) });
  }
  return tasks;
}

/** Downloads já feitos nesta execução (o cron reaproveita entre perfis). */
export type JobCache = Map<string, Promise<ScrapedJob[]>>;

export async function collectJobs(
  tasks: readonly SourceTask[],
  fetchJson: FetchJson,
  cache: JobCache = new Map(),
): Promise<{ jobs: ScrapedJob[]; errors: string[] }> {
  const results = await mapLimit(tasks, CONCURRENCY, async (task) => {
    let pending = cache.get(task.key);
    if (!pending) {
      pending = fetchJson(task.url).then(task.parse);
      cache.set(task.key, pending);
    }
    try {
      return { jobs: await pending, error: null };
    } catch (error) {
      const detail = error instanceof SourceError ? error.message : "falhou";
      return { jobs: [], error: `${task.label}: ${detail}` };
    }
  });

  const seen = new Set<string>();
  const jobs: ScrapedJob[] = [];
  for (const result of results) {
    for (const job of result.jobs) {
      const key = `${job.source}:${job.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(job);
    }
  }
  const errors = [...new Set(results.map((result) => result.error).filter((error): error is string => error !== null))];
  return { jobs, errors };
}

/** Vagas compatíveis, da nota mais alta para a mais baixa (e, no empate, a mais recente). */
export function rankJobs(jobs: readonly ScrapedJob[], profile: SearchProfile, today: string): ScoredJob[] {
  const ranked: ScoredJob[] = [];
  for (const job of jobs) {
    const match = scoreJob(job, profile, today);
    if (match.excluded || match.score < MIN_SCORE) continue;
    ranked.push({ ...job, score: match.score, reasons: match.reasons, warnings: match.warnings });
  }
  return ranked.sort(
    (a, b) => b.score - a.score || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
}

/** Endereço sem parâmetros, para comparar links ("...?jobBoardSource=gupy_portal"). */
export function urlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function titleKey(title: string): string {
  return fold(title).replace(/[^a-z0-9]/g, "");
}

/**
 * Vagas que não devem virar sugestão de novo: já sugeridas antes (mesmo as
 * descartadas) ou já no quadro (mesmo link, ou mesma empresa e mesmo cargo).
 */
export function buildSkipCheck(
  existingLeads: readonly { source: string; external_id: string }[],
  applications: readonly { company: string; role_title: string; job_url: string | null }[],
): (job: ScrapedJob) => boolean {
  const leadKeys = new Set(existingLeads.map((lead) => `${lead.source}:${lead.external_id}`));
  const urls = new Set(applications.map((application) => application.job_url).filter(Boolean).map((url) => urlKey(url!)));
  const pairs = new Set(applications.map((application) => `${companyKey(application.company)}|${titleKey(application.role_title)}`));
  return (job) =>
    leadKeys.has(`${job.source}:${job.externalId}`) ||
    urls.has(urlKey(job.url)) ||
    pairs.has(`${companyKey(job.company)}|${titleKey(job.title)}`);
}

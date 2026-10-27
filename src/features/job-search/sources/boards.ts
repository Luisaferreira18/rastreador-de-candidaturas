/**
 * Greenhouse e Lever: listagens públicas oficiais das páginas de vagas das
 * empresas (Job Board API do Greenhouse e Postings API do Lever), sem login.
 */

import { detectJobType, detectOtherType, detectWorkModel } from "../classify";
import { stripHtml } from "../text";
import type { BoardRef, ScrapedJob } from "../types";
import { SourceError } from "./http";

export function boardApiUrl(board: BoardRef): string {
  return board.source === "greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.slug)}/jobs`
    : `https://api.lever.co/v0/postings/${encodeURIComponent(board.slug)}?mode=json`;
}

/** Nome da empresa quando a página não está na lista pronta: "stone" → "Stone". */
function companyFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

// ---------------------------------------------------------------------------
// Greenhouse
// ---------------------------------------------------------------------------

type GreenhouseJob = {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  location?: { name?: string } | null;
  first_published?: string | null;
  updated_at?: string | null;
  application_deadline?: string | null;
};

export function normalizeGreenhouseJob(job: GreenhouseJob, board: BoardRef): ScrapedJob | null {
  if (job.id === undefined || !job.title || !job.absolute_url?.startsWith("https://")) return null;
  const title = job.title.trim();
  const location = job.location?.name?.trim() || null;
  return {
    source: "greenhouse",
    externalId: String(job.id),
    company: board.company ?? companyFromSlug(board.slug),
    title: title.slice(0, 200),
    url: job.absolute_url,
    location: location?.slice(0, 200) ?? null,
    city: null,
    state: null,
    workModel: detectWorkModel(`${title} ${location ?? ""}`),
    jobType: detectJobType(title),
    otherType: detectOtherType(title),
    country: null,
    salaryCents: null,
    publishedAt: job.first_published ?? job.updated_at ?? null,
    deadline: job.application_deadline ? job.application_deadline.slice(0, 10) : null,
    text: "",
  };
}

export function parseGreenhouseResponse(json: unknown, board: BoardRef): ScrapedJob[] {
  const jobs = (json as { jobs?: unknown })?.jobs;
  if (!Array.isArray(jobs)) throw new SourceError("respondeu num formato inesperado");
  return jobs
    .map((job) => normalizeGreenhouseJob(job as GreenhouseJob, board))
    .filter((job): job is ScrapedJob => job !== null);
}

// ---------------------------------------------------------------------------
// Lever
// ---------------------------------------------------------------------------

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  country?: string | null;
  workplaceType?: string;
  categories?: { commitment?: string; location?: string; department?: string; team?: string };
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  salaryRange?: { currency?: string; interval?: string; min?: number; max?: number } | null;
};

const LEVER_WORKPLACE: Record<string, ScrapedJob["workModel"]> = {
  remote: "remoto",
  hybrid: "hibrido",
  onsite: "presencial",
  "on-site": "presencial",
};

/** Só salário em reais, por mês ou por ano (convertido para mês). */
function leverSalaryCents(range: LeverPosting["salaryRange"]): number | null {
  if (!range || range.currency !== "BRL" || typeof range.min !== "number" || range.min <= 0) return null;
  if (range.interval === "per-month-salary") return Math.round(range.min * 100);
  if (range.interval === "per-year-salary") return Math.round((range.min / 12) * 100);
  return null;
}

export function normalizeLeverPosting(posting: LeverPosting, board: BoardRef): ScrapedJob | null {
  if (!posting.id || !posting.text || !posting.hostedUrl?.startsWith("https://")) return null;
  const title = posting.text.trim();
  const categories = posting.categories ?? {};
  const location = categories.location?.trim() || null;
  const commitment = categories.commitment ?? "";
  const lists = (posting.lists ?? []).map((list) => `${list.text ?? ""} ${stripHtml(list.content ?? "")}`).join(" ");
  return {
    source: "lever",
    externalId: posting.id,
    company: board.company ?? companyFromSlug(board.slug),
    title: title.slice(0, 200),
    url: posting.hostedUrl,
    location: location?.slice(0, 200) ?? null,
    city: null,
    state: null,
    workModel:
      (posting.workplaceType ? LEVER_WORKPLACE[posting.workplaceType] : null) ??
      detectWorkModel(`${title} ${location ?? ""} ${commitment}`),
    jobType: detectJobType(`${title} ${commitment}`),
    otherType: detectOtherType(title),
    country: posting.country ?? null,
    salaryCents: leverSalaryCents(posting.salaryRange),
    publishedAt: typeof posting.createdAt === "number" ? new Date(posting.createdAt).toISOString() : null,
    deadline: null,
    text: [categories.department, categories.team, posting.descriptionPlain, lists]
      .filter(Boolean)
      .join(" ")
      .slice(0, 6000),
  };
}

export function parseLeverResponse(json: unknown, board: BoardRef): ScrapedJob[] {
  if (!Array.isArray(json)) throw new SourceError("respondeu num formato inesperado");
  return json
    .map((posting) => normalizeLeverPosting(posting as LeverPosting, board))
    .filter((job): job is ScrapedJob => job !== null);
}

export function parseBoardResponse(json: unknown, board: BoardRef): ScrapedJob[] {
  return board.source === "greenhouse" ? parseGreenhouseResponse(json, board) : parseLeverResponse(json, board);
}

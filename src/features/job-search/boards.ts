/**
 * Empresas com vagas no Brasil que publicam pelo Greenhouse ou pelo Lever.
 * As duas plataformas têm uma listagem pública oficial por empresa (sem
 * login), mas não uma busca geral: por isso existe esta lista pronta, e a
 * pessoa pode acrescentar outras páginas no perfil.
 *
 * Conferida em out/2026: todas responderam com vagas no Brasil.
 */

import type { BoardRef } from "./types";

export const COMPANY_BOARDS: readonly Required<BoardRef>[] = [
  { source: "greenhouse", slug: "quintoandar", company: "QuintoAndar" },
  { source: "greenhouse", slug: "stone", company: "Stone" },
  { source: "greenhouse", slug: "c6bank", company: "C6 Bank" },
  { source: "greenhouse", slug: "inter", company: "Inter" },
  { source: "greenhouse", slug: "xpinc", company: "XP Inc." },
  { source: "greenhouse", slug: "btgpactual", company: "BTG Pactual" },
  { source: "greenhouse", slug: "agibank", company: "Agibank" },
  { source: "greenhouse", slug: "bancopan", company: "Banco PAN" },
  { source: "greenhouse", slug: "vtex", company: "VTEX" },
  { source: "greenhouse", slug: "ebanx", company: "EBANX" },
  { source: "greenhouse", slug: "gympass", company: "Wellhub" },
  { source: "greenhouse", slug: "wildlifestudios", company: "Wildlife Studios" },
  { source: "greenhouse", slug: "rdstation", company: "RD Station" },
  { source: "greenhouse", slug: "jusbrasil", company: "Jusbrasil" },
  { source: "greenhouse", slug: "sumup", company: "SumUp" },
  { source: "greenhouse", slug: "datadog", company: "Datadog" },
  { source: "lever", slug: "ciandt", company: "CI&T" },
  { source: "lever", slug: "neon", company: "Neon" },
  { source: "lever", slug: "swile", company: "Swile" },
  { source: "lever", slug: "dlocal", company: "dLocal" },
];

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

/**
 * Entende o que a pessoa colou: o link da página de vagas ou "greenhouse:empresa".
 *   https://boards.greenhouse.io/nubank
 *   https://job-boards.greenhouse.io/stone/jobs/123
 *   https://jobs.lever.co/ciandt
 */
export function parseBoardInput(input: string): BoardRef | null {
  const value = input.trim();
  const prefixed = /^(greenhouse|lever):([a-z0-9-]+)$/i.exec(value);
  if (prefixed) {
    const slug = prefixed[2].toLowerCase();
    return SLUG.test(slug) ? { source: prefixed[1].toLowerCase() as BoardRef["source"], slug } : null;
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  let source: BoardRef["source"] | null = null;
  let slug: string | undefined;
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    source = "greenhouse";
    // boards-api.greenhouse.io/v1/boards/<slug>/jobs
    slug = segments[0] === "v1" && segments[1] === "boards" ? segments[2] : segments[0];
    // boards.greenhouse.io/embed/job_board?for=<slug>
    if (slug === "embed") slug = url.searchParams.get("for") ?? undefined;
  } else if (host === "jobs.lever.co" || host === "api.lever.co") {
    source = "lever";
    slug = host === "api.lever.co" ? segments[2] : segments[0];
  }

  if (!source || !slug) return null;
  slug = slug.toLowerCase();
  return SLUG.test(slug) ? { source, slug } : null;
}

/** Forma guardada no banco: "greenhouse:stone". */
export function boardKey(board: BoardRef): string {
  return `${board.source}:${board.slug}`;
}

/** Link público da página de vagas (para mostrar no perfil). */
export function boardUrl(board: BoardRef): string {
  return board.source === "greenhouse"
    ? `https://job-boards.greenhouse.io/${board.slug}`
    : `https://jobs.lever.co/${board.slug}`;
}

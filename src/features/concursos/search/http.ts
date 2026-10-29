/**
 * Downloads das fontes de concursos, com tempo limite, tamanho máximo e um
 * identificador honesto. Recebidos de fora nas funções da busca, para os
 * testes rodarem sem internet.
 */

import { SourceError } from "@/features/job-search/sources/http";

export { SourceError };

export const USER_AGENT = "RastreadorDeCandidaturas/1.0 (busca diaria de concursos)";

export type Fetcher = {
  json: (url: string) => Promise<unknown>;
  text: (url: string, init?: { headers?: Record<string, string> }) => Promise<string>;
  /** Arquivo binário (os ZIP do Diário Oficial). */
  bytes: (url: string, init?: { headers?: Record<string, string>; maxBytes?: number }) => Promise<Uint8Array>;
  /** Formulário de login (INLABS): devolve os cookies da resposta. */
  login: (url: string, form: Record<string, string>, headers?: Record<string, string>) => Promise<string[]>;
};

const TIMEOUT_MS = 30_000;
/** O arquivo do mês da Seção 3 passa de 60 MB. */
const DEFAULT_MAX_BYTES = 120 * 1024 * 1024;

async function request(url: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new SourceError(timedOut ? "não respondeu a tempo" : "não foi possível conectar");
  }
  if (response.status === 404) throw new SourceError("arquivo não encontrado");
  if (!response.ok && response.status !== 302) throw new SourceError(`respondeu com erro ${response.status}`);
  return response;
}

export const defaultFetcher: Fetcher = {
  async json(url) {
    const response = await request(url, { headers: { Accept: "application/json" } });
    try {
      return await response.json();
    } catch {
      throw new SourceError("respondeu num formato inesperado");
    }
  },
  async text(url, init) {
    return (await request(url, { headers: init?.headers })).text();
  },
  async bytes(url, init) {
    const response = await request(url, { headers: init?.headers }, 120_000);
    const max = init?.maxBytes ?? DEFAULT_MAX_BYTES;
    if (Number(response.headers.get("content-length") ?? 0) > max) throw new SourceError("arquivo grande demais");
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length > max) throw new SourceError("arquivo grande demais");
    return buffer;
  },
  async login(url, form, headers) {
    const response = await request(url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
      body: new URLSearchParams(form).toString(),
    });
    return response.headers.getSetCookie();
  },
};

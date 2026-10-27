/** Busca JSON das fontes de vagas, com tempo limite e um identificador honesto. */

export type FetchJson = (url: string) => Promise<unknown>;

export const USER_AGENT = "RastreadorDeCandidaturas/1.0 (busca diaria de vagas)";
const TIMEOUT_MS = 15_000;

export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

export const fetchJson: FetchJson = async (url) => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new SourceError(timedOut ? "não respondeu a tempo" : "não foi possível conectar");
  }
  if (response.status === 404) throw new SourceError("página de vagas não encontrada");
  if (!response.ok) throw new SourceError(`respondeu com erro ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new SourceError("respondeu num formato inesperado");
  }
};

/** Roda `fn` em no máximo `limit` itens ao mesmo tempo, mantendo a ordem. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

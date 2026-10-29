/**
 * Baixa o edital a partir do link que a pessoa colou (PDF, página ou texto).
 *
 * Como o servidor acessa um endereço escolhido por quem usa o app, há
 * proteções contra SSRF: só http(s) nas portas padrão, nada de endereços
 * internos (a checagem é feita na hora de conectar, então trocar o DNS no meio
 * do caminho não adianta), no máximo 3 redirecionamentos, 10 MB e 20 segundos.
 */

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { isPdf, PdfError, readPdfText } from "@/features/resume/pdf";

export class NoticeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoticeFetchError";
  }
}

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
/** Editais longos passam de cem páginas. */
const MAX_PDF_PAGES = 300;
const USER_AGENT = "RastreadorDeCandidaturas/1.0 (leitura de edital a pedido da pessoa)";

/** Endereço da rede interna, da própria máquina ou reservado? */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const value = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
    if (mapped) return isPrivateAddress(mapped[1]);
    return value === "::" || value === "::1" || /^f[cd]/.test(value) || /^fe[89ab]/.test(value) || value.startsWith("ff");
  }
  return true;
}

/** Link aceito: http(s), sem usuário e senha, nas portas padrão e sem IP interno escrito direto. */
export function checkNoticeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NoticeFetchError("Link inválido. Cole o endereço completo do edital, como https://...");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new NoticeFetchError("Use um link que comece com https://.");
  if (url.username || url.password) throw new NoticeFetchError("Use o link público do edital, sem usuário e senha.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new NoticeFetchError("Esse link usa uma porta que não é aceita.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || (net.isIP(host) && isPrivateAddress(host))) {
    throw new NoticeFetchError("Esse endereço não é público.");
  }
  return url;
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/** Resolve o nome e só deixa conectar em endereços públicos. */
function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address.address))) {
      return callback(new NoticeFetchError("Esse endereço não é público.") as NodeJS.ErrnoException, "");
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

type Fetched = { url: URL; contentType: string; body: Buffer };

function requestOnce(url: URL): Promise<{ status: number; location: string | null; contentType: string; body: Buffer }> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        lookup: safeLookup as never,
        headers: { "User-Agent": USER_AGENT, Accept: "application/pdf,text/html,text/plain;q=0.9,*/*;q=0.5", "Accept-Encoding": "gzip, deflate, br" },
        timeout: TIMEOUT_MS,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          response.resume();
          resolve({ status, location: response.headers.location ?? null, contentType: "", body: Buffer.alloc(0) });
          return;
        }
        const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip"
            ? response.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? response.pipe(zlib.createInflate())
              : encoding === "br"
                ? response.pipe(zlib.createBrotliDecompress())
                : response;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy();
            reject(new NoticeFetchError("O arquivo passa de 10 MB. Copie e cole só a parte do edital que interessa."));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () =>
          resolve({ status, location: null, contentType: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }),
        );
        stream.on("error", () => reject(new NoticeFetchError("Não foi possível ler a resposta do site.")));
      },
    );
    request.on("timeout", () => request.destroy(new NoticeFetchError("O site do edital demorou demais para responder.")));
    request.on("error", (error) =>
      reject(error instanceof NoticeFetchError ? error : new NoticeFetchError("Não foi possível acessar esse link. Confira o endereço.")),
    );
  });
}

/** Baixa seguindo até 3 redirecionamentos, conferindo cada endereço. */
async function download(raw: string): Promise<Fetched> {
  let url = checkNoticeUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await requestOnce(url);
    if (response.location) {
      url = checkNoticeUrl(new URL(response.location, url).toString());
      continue;
    }
    if (response.status === 404) throw new NoticeFetchError("Esse link não existe mais (erro 404).");
    if (response.status >= 400) throw new NoticeFetchError(`O site respondeu com erro ${response.status}.`);
    return { url, contentType: response.contentType.toLowerCase(), body: response.body };
  }
  throw new NoticeFetchError("O link redireciona vezes demais.");
}

/** Página HTML em texto, mantendo linhas e células de tabela (o leitor usa as duas). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Página de um concurso com pouco texto e um link para o PDF do edital (como
 * nas páginas das bancas): o link do PDF.
 */
export function editalPdfLink(html: string, base: URL): string | null {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: match[1],
    label: match[2].replace(/<[^>]+>/g, " "),
  }));
  const best =
    links.find((link) => /edital/i.test(`${link.label} ${link.href}`) && /abertura|normativo|completo/i.test(`${link.label} ${link.href}`)) ??
    links.find((link) => /edital/i.test(`${link.label} ${link.href}`));
  // Visualizador com o PDF num quadro (como o do Diário Oficial da União).
  const frame = [...html.matchAll(/<(?:iframe|frame|embed)\b[^>]*src=["']([^"']+)["']/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&"))
    .find((src) => /pdf/i.test(src));
  const href = best?.href ?? frame;
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function decodeText(body: Buffer, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  return new TextDecoder(charset === "iso-8859-1" || charset === "windows-1252" ? "windows-1252" : "utf-8").decode(body);
}

async function pdfText(body: Buffer): Promise<string> {
  try {
    return await readPdfText(new Uint8Array(body), { maxPages: MAX_PDF_PAGES });
  } catch (error) {
    if (error instanceof PdfError) throw new NoticeFetchError(error.message);
    throw new NoticeFetchError("Não foi possível ler esse PDF. Baixe o edital e copie o texto.");
  }
}

/** Texto do edital e o endereço final (depois dos redirecionamentos). */
export async function fetchNoticeText(raw: string): Promise<{ text: string; url: string; isPdf: boolean }> {
  const first = await download(raw);
  if (isPdf(new Uint8Array(first.body)) || first.contentType.includes("application/pdf")) {
    return { text: await pdfText(first.body), url: first.url.toString(), isPdf: true };
  }

  const decoded = decodeText(first.body, first.contentType);
  if (!/html/.test(first.contentType) && !/<html|<body|<div/i.test(decoded.slice(0, 2000))) {
    return { text: decoded, url: first.url.toString(), isPdf: false };
  }

  const text = htmlToPlainText(decoded);
  // Página da banca com o edital em PDF: lê o PDF.
  const pdfLink = text.length < 4000 ? editalPdfLink(decoded, first.url) : null;
  if (pdfLink) {
    const second = await download(pdfLink);
    if (isPdf(new Uint8Array(second.body))) return { text: await pdfText(second.body), url: second.url.toString(), isPdf: true };
  }
  return { text, url: first.url.toString(), isPdf: false };
}

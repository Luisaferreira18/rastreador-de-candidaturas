/**
 * Comparação de textos de vagas: sem acentos, sem palavras vazias e com
 * sinônimos em português e inglês ("Dados" = "Data", "Desenvolvedor" = "Developer").
 */

/** Minúsculas e sem acentos. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Palavras que não dizem nada sobre a área da vaga. */
const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "para", "a", "o", "as", "os", "com", "na", "no",
  "nas", "nos", "of", "and", "the", "to", "in", "for", "at", "on", "ou", "or", "por", "um", "uma",
  "vaga", "vagas", "programa", "time", "equipe", "area", "setor", "team", "oportunidade",
  "pcd", "exclusiva", "exclusivo", "afirmativa", "pessoas", "deficiencia", "banco", "talentos",
]);

/**
 * Palavras de nível ou de tipo de contrato: entram na nota pelo "tipo de vaga",
 * não pelo cargo (senão "Estágio" sozinho bateria com qualquer estágio).
 */
const LEVEL_WORDS = new Set([
  "estagio", "estagiario", "estagiaria", "estagiarios", "intern", "internship", "interns",
  "trainee", "trainees", "junior", "jr", "pleno", "pl", "senior", "sr", "i", "ii", "iii", "iv",
  "aprendiz", "jovem", "temporario", "temporaria", "pj", "clt", "freela", "freelancer",
  "hibrido", "remoto", "presencial", "hybrid", "remote", "onsite", "superior", "tecnico",
]);

/** Grupos de sinônimos: todas as formas viram a primeira. */
const SYNONYM_GROUPS: string[][] = [
  ["dados", "dado", "data"],
  ["desenvolvimento", "desenvolvedor", "desenvolvedora", "developer", "dev", "programador", "programadora", "development"],
  ["engenharia", "engenheiro", "engenheira", "engineer", "engineering"],
  ["analise", "analista", "analyst", "analytics", "analysis", "analitico", "analitica"],
  ["financas", "financeiro", "financeira", "finance", "financial"],
  ["rh", "recursos", "humanos", "people", "hr", "gente"],
  ["vendas", "comercial", "sales", "vendedor", "vendedora"],
  ["produto", "product", "produtos", "products"],
  ["design", "designer", "ux", "ui"],
  ["juridico", "juridica", "direito", "legal", "advogado", "advogada"],
  ["contabilidade", "contabil", "accounting", "contador", "contadora"],
  ["marketing", "mkt"],
  ["tecnologia", "ti", "technology", "tech"],
  ["suporte", "support"],
  ["seguranca", "security", "cyber", "ciberseguranca"],
  ["negocios", "negocio", "business"],
  ["ciencia", "science", "scientist", "cientista"],
  ["operacoes", "operacao", "operations", "ops", "operacional"],
  ["logistica", "logistics", "supply"],
  ["administrativo", "administrativa", "administracao", "administration", "admin"],
  ["comunicacao", "communication", "communications"],
  ["atendimento", "customer", "cliente", "clientes", "cx"],
  ["qualidade", "quality", "qa", "testes", "tester"],
  ["infraestrutura", "infra", "infrastructure", "devops", "sre", "cloud"],
  ["frontend", "front"],
  ["backend", "back"],
  ["mobile", "android", "ios"],
  ["auditoria", "audit", "auditor"],
  ["riscos", "risco", "risk", "risks"],
  ["credito", "credit"],
  ["investimentos", "investimento", "investment", "investments"],
  ["compras", "procurement", "purchasing", "suprimentos"],
  ["ia", "ai", "inteligencia", "artificial", "ml"],
  ["bi", "intelligence"],
  ["software", "sistemas", "systems"],
];

const CANONICAL = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) if (!CANONICAL.has(word)) CANONICAL.set(word, group[0]);
}

function canonical(word: string): string {
  const known = CANONICAL.get(word);
  if (known) return known;
  // Plural simples: "contratos" → "contrato".
  if (word.length > 4 && word.endsWith("s") && CANONICAL.has(word.slice(0, -1))) return CANONICAL.get(word.slice(0, -1))!;
  return word;
}

/** Palavras do texto, sem acentos (ex.: "Estágio em Dados" → ["estagio", "em", "dados"]). */
export function words(text: string): string[] {
  return fold(text)
    .replace(/front-end/g, "frontend")
    .replace(/back-end/g, "backend")
    // Expressões em que "desenvolvimento" não é programação.
    .replace(/treinamento (e|&) desenvolvimento|\bt&d\b|desenvolvimento (humano|organizacional)/g, " rh ")
    .replace(/desenvolvimento de negocios|business development/g, " negocios comercial ")
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean);
}

/** Palavras que identificam a área do cargo, já com sinônimos resolvidos. */
export function coreTerms(text: string): string[] {
  const result: string[] = [];
  for (const word of words(text)) {
    if (STOP_WORDS.has(word) || LEVEL_WORDS.has(word) || word.length < 2) continue;
    const term = canonical(word);
    if (!result.includes(term)) result.push(term);
  }
  return result;
}

/** Texto do cargo para a busca da Gupy: "Estágio em Dados" → "dados". */
export function searchTerms(role: string): string {
  return words(role)
    .filter((word) => !STOP_WORDS.has(word) && !LEVEL_WORDS.has(word))
    .join(" ");
}

/** A palavra (ou expressão) aparece no texto, como palavra inteira? */
export function containsTerm(foldedText: string, term: string): boolean {
  const needle = fold(term).trim();
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(foldedText);
}

/** Remove HTML (as descrições da Gupy e do Lever às vezes vêm com tags). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/concursos", label: "Lista" },
  { href: "/concursos/quadro", label: "Quadro" },
  { href: "/concursos/sugeridos", label: "Sugeridos" },
] as const;

export type ConcursosTab = (typeof TABS)[number]["href"];

/** Painel com os órgãos federais que mais abrem vagas (outro projeto, com dados públicos). */
export const RADAR_URL = "https://radar-carreira-dados.vercel.app/concursos";

/** Abas do módulo de concursos, mais o link para o radar de órgãos. */
export function ConcursosNav({ active, className }: { active: ConcursosTab; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <nav aria-label="Seções de concursos" className="inline-flex h-8 rounded-lg border bg-muted/40 p-0.5">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === active ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
              tab.href === active && "bg-background text-foreground shadow-xs ring-1 ring-border",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <a
        href={RADAR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Quais órgãos federais mais abrem vagas?
        <ExternalLink className="size-3" aria-hidden />
        <span className="sr-only">(abre em outra aba)</span>
      </a>
    </div>
  );
}

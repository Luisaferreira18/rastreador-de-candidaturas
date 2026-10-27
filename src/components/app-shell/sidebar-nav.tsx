"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Kbd } from "@/components/kbd";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "./nav-items";

export type NavBadges = Partial<Record<NavItem["href"], number>>;

function NavLinks({
  activePath,
  onNavigate,
  badges,
}: {
  activePath: string | null;
  onNavigate?: () => void;
  badges?: NavBadges;
}) {
  return (
    <nav aria-label="Navegação principal" className="grid gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active =
          activePath === item.href ||
          // A página de detalhe pertence à seção "Quadro".
          (item.href === "/quadro" && activePath?.startsWith("/candidaturas")) ||
          (item.href === "/caixa-de-entrada" && activePath?.startsWith("/caixa-de-entrada")) ||
          (item.href === "/vagas" && activePath?.startsWith("/vagas"));
        const badge = badges?.[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            <item.icon className="size-4" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span
                className="rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-semibold text-primary-foreground tabular-nums group-hover:hidden"
                aria-label={item.href === "/vagas" ? `${badge} novas` : `${badge} pendentes`}
              >
                {badge}
              </span>
            )}
            <span className="hidden items-center gap-0.5 md:group-hover:flex">
              <Kbd>G</Kbd>
              <Kbd>{item.shortcut}</Kbd>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavLinks({ onNavigate, badges }: { onNavigate?: () => void; badges?: NavBadges }) {
  const pathname = usePathname();
  return <NavLinks activePath={pathname} onNavigate={onNavigate} badges={badges} />;
}

/**
 * Links da navegação com destaque da página atual. O `usePathname` fica
 * dentro de um Suspense porque, nas páginas com [id], o caminho só é
 * conhecido na hora da requisição.
 */
export function SidebarNav({ onNavigate, badges }: { onNavigate?: () => void; badges?: NavBadges }) {
  return (
    <Suspense fallback={<NavLinks activePath={null} onNavigate={onNavigate} badges={badges} />}>
      <ActiveNavLinks onNavigate={onNavigate} badges={badges} />
    </Suspense>
  );
}

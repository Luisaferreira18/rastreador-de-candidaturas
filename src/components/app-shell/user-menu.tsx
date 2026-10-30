"use client";

import { ChevronsUpDown, Download, Keyboard, LogOut, Monitor, Moon, PlugZap, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { startTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";
import type { CurrentUser } from "@/features/auth/session";
import { cn } from "@/lib/utils";
import { useAppCommands } from "./app-commands";

function initials(user: CurrentUser): string {
  const source = user.name ?? user.email ?? "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UserMenu({ user, compact = false }: { user: CurrentUser; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { openShortcuts } = useAppCommands();
  const displayName = user.name ?? user.email?.split("@")[0] ?? "Você";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-md text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
          compact ? "p-1" : "w-full p-1.5",
        )}
        aria-label="Menu da conta"
      >
        <Avatar className="size-7">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
            {initials(user)}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              {user.email && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{displayName}</span>
          {user.email && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
            Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun /> Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon /> Escuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor /> Igual ao sistema
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link href="/conexoes">
            <PlugZap /> Conexões (e-mail e WhatsApp)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/api/export" download>
            <Download /> Exportar candidaturas em CSV
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/api/export/concursos" download>
            <Download /> Exportar concursos em CSV
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openShortcuts}>
          <Keyboard /> Atalhos de teclado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => startTransition(() => signOut())}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

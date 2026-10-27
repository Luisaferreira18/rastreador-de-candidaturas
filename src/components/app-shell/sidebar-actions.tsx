"use client";

import { Keyboard, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Kbd } from "@/components/kbd";
import { Button } from "@/components/ui/button";
import { useAppCommands } from "./app-commands";

export function SidebarPrimaryAction() {
  return (
    <Button asChild className="w-full justify-start gap-2">
      <Link href="/candidaturas/nova">
        <Plus />
        <span className="flex-1 text-left">Nova candidatura</span>
        <Kbd className="border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground">N</Kbd>
      </Link>
    </Button>
  );
}

export function SidebarSecondaryActions() {
  const { openPalette, openShortcuts } = useAppCommands();
  const itemClass =
    "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  return (
    <div className="grid gap-0.5">
      <button type="button" onClick={openPalette} className={itemClass}>
        <Search className="size-4" strokeWidth={1.75} />
        <span className="flex-1 text-left">Buscar</span>
        <span className="flex gap-0.5">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <button type="button" onClick={openShortcuts} className={itemClass}>
        <Keyboard className="size-4" strokeWidth={1.75} />
        <span className="flex-1 text-left">Atalhos</span>
        <Kbd>?</Kbd>
      </button>
    </div>
  );
}

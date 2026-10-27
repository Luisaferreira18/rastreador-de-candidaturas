"use client";

import { Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppCommands } from "./app-commands";

/** Barra superior do celular: menu lateral, busca e nova candidatura. */
export function MobileHeader({ userSlot, navSlot }: { userSlot: React.ReactNode; navSlot: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { openPalette } = useAppCommands();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>
              <Logo />
            </SheetTitle>
            <SheetDescription className="sr-only">Navegação do app</SheetDescription>
          </SheetHeader>
          {/* Fecha o menu ao tocar em qualquer link da navegação. */}
          <div
            className="p-3"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {navSlot}
          </div>
        </SheetContent>
      </Sheet>

      <Link href="/painel" className="mr-auto">
        <Logo />
      </Link>

      <Button variant="ghost" size="icon" aria-label="Buscar" onClick={openPalette}>
        <Search />
      </Button>
      <Button asChild size="icon" aria-label="Nova candidatura">
        <Link href="/candidaturas/nova">
          <Plus />
        </Link>
      </Button>
      {userSlot}
    </header>
  );
}

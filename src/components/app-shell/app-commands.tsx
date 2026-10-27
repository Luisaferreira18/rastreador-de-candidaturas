"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "./command-palette";
import { NAV_ITEMS } from "./nav-items";
import { ShortcutsDialog } from "./shortcuts-dialog";

type AppCommands = {
  openPalette: () => void;
  openShortcuts: () => void;
};

const AppCommandsContext = createContext<AppCommands | null>(null);

export function useAppCommands(): AppCommands {
  const context = use(AppCommandsContext);
  if (!context) throw new Error("useAppCommands precisa estar dentro de <AppCommandsProvider>.");
  return context;
}

/** O foco está num campo de texto? Então as teclas são do usuário, não atalhos. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.getAttribute("role") === "combobox"
  );
}

function isOverlayOpen(): boolean {
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"]',
    ),
  );
}

/** Primeiro campo de busca visível na página (páginas ocultas continuam no DOM). */
function findVisibleSearchInput(): HTMLInputElement | null {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-search-input]"));
  return inputs.find((input) => (input.checkVisibility ? input.checkVisibility() : input.offsetParent !== null)) ?? null;
}

const G_SEQUENCE_TIMEOUT = 1200;

/**
 * Atalhos de teclado globais, no estilo do Linear:
 * N nova candidatura · / buscar · Ctrl+K paleta · ? ajuda · G depois P/Q/L navegar.
 */
export function AppCommandsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const gPressedAt = useRef(0);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target) || isOverlayOpen()) return;

      const key = event.key.toLowerCase();

      if (Date.now() - gPressedAt.current < G_SEQUENCE_TIMEOUT) {
        gPressedAt.current = 0;
        const item = NAV_ITEMS.find((navItem) => navItem.shortcut.toLowerCase() === key);
        if (item) {
          event.preventDefault();
          router.push(item.href);
          return;
        }
      }

      switch (key) {
        case "g":
          gPressedAt.current = Date.now();
          return;
        case "n":
          event.preventDefault();
          router.push("/candidaturas/nova");
          return;
        case "/": {
          event.preventDefault();
          const input = findVisibleSearchInput();
          if (input) {
            input.focus();
            input.select();
          } else {
            setPaletteOpen(true);
          }
          return;
        }
        case "?":
          event.preventDefault();
          setShortcutsOpen(true);
          return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const value = useMemo(() => ({ openPalette, openShortcuts }), [openPalette, openShortcuts]);

  return (
    <AppCommandsContext value={value}>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onShowShortcuts={openShortcuts} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </AppCommandsContext>
  );
}

"use client";

import { Kbd } from "@/components/kbd";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["N"], label: "Nova candidatura" },
  { keys: ["/"], label: "Buscar" },
  { keys: ["Ctrl", "K"], label: "Abrir a paleta de comandos" },
  { keys: ["G", "P"], label: "Ir para o painel" },
  { keys: ["G", "Q"], label: "Ir para o quadro" },
  { keys: ["G", "L"], label: "Ir para a lista" },
  { keys: ["G", "C"], label: "Ir para a caixa de entrada" },
  { keys: ["G", "V"], label: "Ir para as vagas sugeridas" },
  { keys: ["G", "O"], label: "Ir para os concursos" },
  { keys: ["?"], label: "Mostrar os atalhos" },
  { keys: ["Esc"], label: "Fechar janelas e menus" },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Funcionam em qualquer tela, fora dos campos de texto.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between py-2.5 text-sm">
              <span>{shortcut.label}</span>
              <span className="flex items-center gap-1">
                {shortcut.keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    {index > 0 && <span className="text-xs text-muted-foreground">{key === "K" ? "+" : "depois"}</span>}
                    <Kbd className="h-6 min-w-6 text-xs">{key}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

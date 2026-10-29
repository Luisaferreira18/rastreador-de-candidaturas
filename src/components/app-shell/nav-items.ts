import { Inbox, KanbanSquare, Landmark, LayoutDashboard, List, Radar, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/painel" | "/quadro" | "/lista" | "/caixa-de-entrada" | "/vagas" | "/concursos";
  label: string;
  icon: LucideIcon;
  /** Segunda tecla do atalho "G + tecla". */
  shortcut: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, shortcut: "P" },
  { href: "/quadro", label: "Quadro", icon: KanbanSquare, shortcut: "Q" },
  { href: "/lista", label: "Lista", icon: List, shortcut: "L" },
  { href: "/caixa-de-entrada", label: "Caixa de entrada", icon: Inbox, shortcut: "C" },
  { href: "/vagas", label: "Vagas sugeridas", icon: Radar, shortcut: "V" },
  { href: "/concursos", label: "Concursos", icon: Landmark, shortcut: "O" },
];

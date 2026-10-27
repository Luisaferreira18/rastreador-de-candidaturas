"use client";

import { ClipboardPaste, Download, Keyboard, Moon, PlugZap, Plus, RefreshCw, SlidersHorizontal, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Kbd } from "@/components/kbd";
import { StageBadge } from "@/components/stage-badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { searchApplications } from "@/features/applications/actions";
import { announceSearch, requestSearch } from "@/features/job-search/search-client";
import type { StageKey } from "@/lib/stages";
import { NAV_ITEMS } from "./nav-items";

type SearchItem = { id: string; company: string; role_title: string; stage: StageKey };

/** Baixa o CSV (é um arquivo, não uma página, então não passa pelo roteador). */
function downloadCsv() {
  const link = document.createElement("a");
  link.href = "/api/export";
  link.download = "";
  link.click();
}

export function CommandPalette({
  open,
  onOpenChange,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, startLoading] = useTransition();

  // Busca as candidaturas sempre que a paleta abre (lista curta e sempre atual).
  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await searchApplications();
      if (result.ok) setItems(result.data);
      else toast.error(result.error);
    });
  }, [open]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Paleta de comandos"
      description="Busque candidaturas ou execute uma ação."
      className="sm:max-w-xl"
    >
      <Command loop>
        <CommandInput placeholder="Buscar candidaturas ou ações…" />
        <CommandList className="max-h-[min(60vh,420px)]">
          <CommandEmpty>{loading ? "Buscando…" : "Nada encontrado."}</CommandEmpty>

          <CommandGroup heading="Ações">
            <CommandItem onSelect={() => run(() => router.push("/candidaturas/nova"))}>
              <Plus />
              Nova candidatura
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem
              keywords={["whatsapp", "recrutador", "mensagem", "email", "colar"]}
              onSelect={() => run(() => router.push("/caixa-de-entrada?colar=1"))}
            >
              <ClipboardPaste />
              Colar mensagem de recrutador
            </CommandItem>
            <CommandItem
              keywords={["caca-vagas", "procurar", "gupy", "greenhouse", "lever", "vagas novas"]}
              onSelect={() =>
                run(() => {
                  router.push("/vagas");
                  void requestSearch(true).then((result) => {
                    announceSearch(result);
                    router.refresh();
                  });
                })
              }
            >
              <RefreshCw />
              Buscar vagas compatíveis agora
            </CommandItem>
            <CommandItem
              keywords={["caca-vagas", "cargos", "cidade", "curriculo", "palavras-chave"]}
              onSelect={() => run(() => router.push("/vagas/perfil"))}
            >
              <SlidersHorizontal />
              Perfil de busca de vagas
            </CommandItem>
            <CommandItem
              keywords={["whatsapp", "gmail", "email", "resumo", "relatorio", "conectar"]}
              onSelect={() => run(() => router.push("/conexoes"))}
            >
              <PlugZap />
              Conexões: e-mail, resumo diário e WhatsApp
            </CommandItem>
            <CommandItem
              keywords={["csv", "planilha", "excel", "baixar"]}
              onSelect={() => run(downloadCsv)}
            >
              <Download />
              Exportar tudo em CSV
            </CommandItem>
            <CommandItem
              keywords={["tema", "modo escuro", "modo claro", "dark", "light"]}
              onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              {resolvedTheme === "dark" ? "Usar modo claro" : "Usar modo escuro"}
            </CommandItem>
            <CommandItem keywords={["teclado", "ajuda"]} onSelect={() => run(onShowShortcuts)}>
              <Keyboard />
              Atalhos de teclado
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ir para">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
                <item.icon />
                {item.label}
                <CommandShortcut className="flex gap-0.5">
                  <Kbd>G</Kbd>
                  <Kbd>{item.shortcut}</Kbd>
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          {items && items.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Candidaturas">
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.company} ${item.role_title} ${item.id}`}
                    onSelect={() => run(() => router.push(`/candidaturas/${item.id}`))}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{item.company}</span>
                      <span className="truncate text-xs text-muted-foreground">{item.role_title}</span>
                    </div>
                    <StageBadge stage={item.stage} short />
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

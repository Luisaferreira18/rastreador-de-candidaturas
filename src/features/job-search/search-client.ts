"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { pluralize } from "@/lib/format";
import type { SearchResponse } from "./types";

/**
 * Estado da busca compartilhado pela página: o botão "Buscar agora", a busca
 * automática ao abrir o app e o formulário do perfil usam a mesma busca, e
 * nunca rodam duas ao mesmo tempo.
 */
let running = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSearchRunning(): boolean {
  return useSyncExternalStore(subscribe, () => running, () => false);
}

export async function requestSearch(force: boolean): Promise<SearchResponse> {
  if (running) return { status: "em-andamento" };
  running = true;
  emit();
  try {
    const response = await fetch("/api/vagas/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    const body = (await response.json().catch(() => null)) as SearchResponse | null;
    if (body && "status" in body) return body;
    return { status: "erro", message: "Não foi possível buscar vagas agora. Tente de novo em instantes." };
  } catch {
    return { status: "erro", message: "Sem conexão com o servidor. Confira a internet e tente de novo." };
  } finally {
    running = false;
    emit();
  }
}

/**
 * Avisa o resultado. Na busca automática (`quiet`), só fala quando há vagas novas.
 */
export function announceSearch(result: SearchResponse, { quiet = false, onOpen }: { quiet?: boolean; onOpen?: () => void } = {}) {
  if (result.status === "ok") {
    const { added, analyzed, errors } = result.stats;
    if (added > 0) {
      toast.success(`${pluralize(added, "vaga nova compatível", "vagas novas compatíveis")} com o seu perfil`, {
        description: `Entre ${pluralize(analyzed, "vaga analisada", "vagas analisadas")}.`,
        action: onOpen ? { label: "Ver", onClick: onOpen } : undefined,
      });
    } else if (!quiet) {
      toast("Nenhuma vaga nova desta vez", {
        description: `${pluralize(analyzed, "vaga analisada", "vagas analisadas")}. A busca roda de novo amanhã.`,
      });
    }
    if (!quiet && errors.length > 0) {
      toast.warning("Algumas fontes não responderam", { description: errors.slice(0, 3).join(" · ") });
    }
    return;
  }
  if (quiet) return;
  if (result.status === "recente") toast.info("Uma busca acabou de rodar. Tente de novo em alguns minutos.");
  else if (result.status === "sem-perfil") toast.info("Monte seu perfil de busca primeiro.");
  else if (result.status === "erro") toast.error(result.message);
}

"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime, pluralize } from "@/lib/format";
import { announceSearch, requestSearch, useSearchRunning } from "../search-client";
import type { SearchStats } from "../types";

export function SearchNowButton() {
  const router = useRouter();
  const running = useSearchRunning();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={running}
      onClick={async () => {
        const result = await requestSearch(true);
        announceSearch(result);
        router.refresh();
      }}
    >
      {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {running ? "Buscando…" : "Buscar agora"}
    </Button>
  );
}

/** Linha com o resultado da última busca (ou o andamento da atual). */
export function SearchStatus({ stats, autoSearch }: { stats: SearchStats | null; autoSearch: boolean }) {
  const running = useSearchRunning();

  if (running) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin text-primary" />
        Buscando vagas na Gupy e nas páginas de carreira das empresas…
      </p>
    );
  }
  if (!stats || !stats.finishedAt) {
    return <p className="text-sm text-muted-foreground">A primeira busca começa em instantes.</p>;
  }
  return (
    <div className="space-y-1 text-sm text-muted-foreground" role="status">
      <p>
        Última busca em {formatDateTime(stats.finishedAt)}: {pluralize(stats.analyzed, "vaga analisada", "vagas analisadas")},{" "}
        {pluralize(stats.matched, "compatível", "compatíveis")}, {pluralize(stats.added, "nova", "novas")}.
        {autoSearch ? " A próxima roda amanhã cedo." : " A busca automática está desligada."}
      </p>
      {stats.errors.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Não responderam: {stats.errors.join(" · ")}. As outras fontes funcionaram; a próxima busca tenta de novo.
          </span>
        </p>
      )}
    </div>
  );
}

/** Fora do componente: sobrevive à montagem dupla do modo de desenvolvimento. */
let started = false;

/**
 * Ao abrir o app, roda a busca do dia se ainda não rodou (o servidor confere
 * o intervalo de 20 horas). Só avisa quando encontra vagas novas.
 */
export function JobSearchAutoRunner() {
  const router = useRouter();

  useEffect(() => {
    if (started) return;
    // Espera a página carregar antes de começar.
    const timer = setTimeout(async () => {
      if (started) return;
      started = true;
      const result = await requestSearch(false);
      if (result.status !== "ok") return;
      announceSearch(result, { quiet: true, onOpen: () => router.push("/vagas") });
      if (result.stats.added > 0) router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}

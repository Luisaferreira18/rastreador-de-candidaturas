"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ConcursoSearchResponse } from "../search/types";

async function requestConcursoSearch(force: boolean): Promise<ConcursoSearchResponse> {
  try {
    const response = await fetch("/api/concursos/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    return ((await response.json().catch(() => null)) as ConcursoSearchResponse | null) ?? {
      status: "erro",
      message: "Resposta inesperada do servidor.",
    };
  } catch {
    return { status: "erro", message: "Não conseguimos falar com o servidor. Verifique sua conexão." };
  }
}

function announce(result: ConcursoSearchResponse) {
  switch (result.status) {
    case "ok": {
      const { added, errors } = result.stats;
      const title = added > 0 ? `${added} ${added === 1 ? "concurso novo" : "concursos novos"} para você` : "Nenhum concurso novo agora";
      const description = errors.length > 0 ? `Fonte com problema: ${errors.join("; ")}.` : undefined;
      if (added > 0) toast.success(title, { description });
      else toast(title, { description: description ?? "A busca roda todo dia; novos editais aparecem aqui." });
      break;
    }
    case "recente":
      toast("Busca feita há pouco", { description: "Espere uns minutos para buscar de novo." });
      break;
    case "sem-perfil":
      toast.error("Monte o perfil de concursos antes de buscar.");
      break;
    case "desligada":
      break;
    case "erro":
      toast.error(result.message);
  }
}

/** Botão "Buscar agora" (no máximo uma vez a cada 2 minutos). */
export function ConcursoSearchButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  return (
    <Button
      size={size}
      variant="outline"
      disabled={running}
      onClick={async () => {
        setRunning(true);
        const result = await requestConcursoSearch(true);
        setRunning(false);
        announce(result);
        router.refresh();
      }}
    >
      {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {running ? "Buscando…" : "Buscar agora"}
    </Button>
  );
}

/** Ao abrir a página: busca sozinho se a última busca foi há mais de 20 horas. */
export function ConcursoAutoRunner() {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void requestConcursoSearch(false).then((result) => {
      if (result.status === "ok") {
        if (result.stats.added > 0) announce(result);
        router.refresh();
      }
    });
  }, [router]);
  return null;
}

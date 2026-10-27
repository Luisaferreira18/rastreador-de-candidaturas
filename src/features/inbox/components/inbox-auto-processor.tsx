"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { processInbox } from "../actions";

const MIN_INTERVAL = 60_000;
/** Fora do componente: sobrevive à montagem dupla do modo de desenvolvimento. */
let lastRun = 0;

/**
 * Ao abrir o app (e ao voltar para a aba), aplica sozinho as sugestões
 * inequívocas que chegaram por e-mail e avisa o que mudou.
 */
export function InboxAutoProcessor() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      if (Date.now() - lastRun < MIN_INTERVAL) return;
      lastRun = Date.now();
      const result = await processInbox();
      if (!result.ok) return;
      // Os avisos são globais: aparecem mesmo que a pessoa já tenha mudado de página.
      for (const change of result.data.applied) {
        toast.success(change.summary, {
          description: "Atualizado automaticamente pelo seu e-mail.",
          action: { label: "Ver", onClick: () => router.push(`/candidaturas/${change.applicationId}`) },
        });
      }
    }

    void run();
    function onVisibility() {
      if (document.visibilityState === "visible") void run();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}

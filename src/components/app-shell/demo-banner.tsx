"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resetDemoData } from "@/features/demo/actions";

/** Aviso fixo no topo quando a pessoa está na conta de demonstração. */
export function DemoBanner() {
  const [pending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      const result = await resetDemoData();
      if (result.ok) toast.success("Dados de exemplo restaurados.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-primary/[0.06] px-4 py-1.5 text-center text-xs text-foreground/80">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        <span>
          Você está na <strong className="font-semibold">conta de demonstração</strong>. Fique à vontade para mexer:
          os dados voltam ao original todo dia.
        </span>
      </span>
      <Button variant="ghost" size="xs" onClick={handleReset} disabled={pending} className="h-6">
        <RotateCcw className={pending ? "animate-spin" : undefined} />
        {pending ? "Restaurando…" : "Restaurar agora"}
      </Button>
    </div>
  );
}

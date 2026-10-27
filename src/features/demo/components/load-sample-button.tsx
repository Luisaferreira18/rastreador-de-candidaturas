"use client";

import { Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadSampleData } from "../actions";

export function LoadSampleDataButton({ variant = "outline" }: { variant?: "outline" | "ghost" | "default" }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await loadSampleData();
          if (result.ok) toast.success(`${result.data.applications} candidaturas de exemplo adicionadas.`);
          else toast.error(result.error);
        })
      }
    >
      <Sparkles className={pending ? "animate-pulse" : undefined} />
      {pending ? "Carregando…" : "Carregar dados de exemplo"}
    </Button>
  );
}

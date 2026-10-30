"use client";

import { Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadSampleConcursos, loadSampleData } from "../actions";

async function load(kind: "candidaturas" | "concursos") {
  if (kind === "concursos") {
    const result = await loadSampleConcursos();
    if (result.ok) toast.success(`${result.data.concursos} concursos de exemplo adicionados.`);
    else toast.error(result.error);
    return;
  }
  const result = await loadSampleData();
  if (result.ok) toast.success(`${result.data.applications} candidaturas de exemplo adicionadas.`);
  else toast.error(result.error);
}

export function LoadSampleDataButton({
  variant = "outline",
  kind = "candidaturas",
}: {
  variant?: "outline" | "ghost" | "default";
  kind?: "candidaturas" | "concursos";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() => startTransition(() => load(kind))}
    >
      <Sparkles className={pending ? "animate-pulse" : undefined} />
      {pending ? "Carregando…" : "Carregar dados de exemplo"}
    </Button>
  );
}

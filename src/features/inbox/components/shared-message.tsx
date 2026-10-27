"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { analyzePastedMessage } from "../actions";

/** Recebe o texto compartilhado pelo Android, cria a sugestão e abre a caixa de entrada. */
export function SharedMessage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const text = [searchParams.get("title"), searchParams.get("text"), searchParams.get("url")]
      .filter(Boolean)
      .join("\n")
      .trim();

    void analyzePastedMessage(text).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Mensagem recebida. Confira a sugestão.");
      router.replace("/caixa-de-entrada");
    });
  }, [router, searchParams]);

  if (error) {
    return (
      <p role="alert" className="max-w-sm text-center text-sm text-destructive">
        {error}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Analisando a mensagem…
    </p>
  );
}

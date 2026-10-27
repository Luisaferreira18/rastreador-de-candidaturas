"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <EmptyState
        icon={TriangleAlert}
        title="Não foi possível carregar esta página"
        description="Pode ter sido uma falha de conexão ou o servidor demorou para responder. Seus dados estão seguros."
      >
        <Button onClick={() => retry()}>
          <RotateCcw /> Tentar de novo
        </Button>
        <Button variant="outline" asChild>
          <Link href="/painel">Ir para o painel</Link>
        </Button>
      </EmptyState>
    </div>
  );
}

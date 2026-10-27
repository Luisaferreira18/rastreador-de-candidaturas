import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="O endereço pode estar errado ou a página mudou de lugar."
        className="w-full max-w-lg"
      >
        <Button asChild>
          <Link href="/painel">Ir para o painel</Link>
        </Button>
      </EmptyState>
    </div>
  );
}

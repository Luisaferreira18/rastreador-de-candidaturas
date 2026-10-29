import { FileSearch } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ConcursoNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <EmptyState
        icon={FileSearch}
        title="Concurso não encontrado"
        description="Ele pode ter sido excluído, ou o link está incompleto."
      >
        <Button asChild>
          <Link href="/concursos">Voltar aos concursos</Link>
        </Button>
      </EmptyState>
    </div>
  );
}

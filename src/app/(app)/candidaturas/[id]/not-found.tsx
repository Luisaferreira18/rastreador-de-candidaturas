import { FileSearch } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ApplicationNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <EmptyState
        icon={FileSearch}
        title="Candidatura não encontrada"
        description="Ela pode ter sido excluída, ou o link está incompleto."
      >
        <Button asChild>
          <Link href="/quadro">Voltar ao quadro</Link>
        </Button>
      </EmptyState>
    </div>
  );
}

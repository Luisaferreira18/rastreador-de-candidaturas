import { FileSearch, Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Estado vazio quando a pessoa ainda não cadastrou nenhum concurso. */
export function NoConcursos({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Landmark}
      title="Nenhum concurso por aqui ainda"
      description="Cadastre os concursos que você acompanha, ou cole um edital para o app preencher órgão, cargo e cronograma. A contagem até a prova e as matérias ficam num lugar só."
      className={className}
    >
      <Button asChild>
        <Link href="/concursos/ler-edital">
          <FileSearch /> Ler edital
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/concursos/novo">
          <Plus /> Novo concurso
        </Link>
      </Button>
    </EmptyState>
  );
}

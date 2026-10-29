import { Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Estado vazio quando a pessoa ainda não cadastrou nenhum concurso. */
export function NoConcursos({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Landmark}
      title="Nenhum concurso por aqui ainda"
      description="Cadastre os concursos que você acompanha: o cronograma, as matérias e a contagem até a prova ficam num lugar só."
      className={className}
    >
      <Button asChild>
        <Link href="/concursos/novo">
          <Plus /> Novo concurso
        </Link>
      </Button>
    </EmptyState>
  );
}

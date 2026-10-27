import { Plus, Send } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { LoadSampleDataButton } from "@/features/demo/components/load-sample-button";

/** Estado vazio quando a pessoa ainda não cadastrou nenhuma candidatura. */
export function NoApplications({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Send}
      title="Nenhuma candidatura por aqui ainda"
      description="Cadastre a primeira vaga que você quer acompanhar, ou carregue alguns exemplos para explorar o app."
      className={className}
    >
      <Button asChild>
        <Link href="/candidaturas/nova">
          <Plus /> Nova candidatura
        </Link>
      </Button>
      <LoadSampleDataButton />
    </EmptyState>
  );
}

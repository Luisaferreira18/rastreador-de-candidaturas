import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/features/applications/components/form-skeleton";
import { ConcursoForm } from "@/features/concursos/components/concurso-form";
import { emptyConcursoFormValues } from "@/features/concursos/schema";
import { isConcursoStageKey } from "@/lib/concurso-stages";

export const metadata: Metadata = { title: "Novo concurso" };

export default function NewConcursoPage({ searchParams }: PageProps<"/concursos/novo">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/concursos">
          <ArrowLeft /> Voltar aos concursos
        </Link>
      </Button>
      <PageHeader
        title="Novo concurso"
        description="Só órgão e cargo são obrigatórios. O cronograma e as matérias você completa quando quiser."
        className="mb-8"
      />
      <Suspense fallback={<FormSkeleton />}>
        <NewConcursoForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewConcursoForm({ searchParams }: { searchParams: PageProps<"/concursos/novo">["searchParams"] }) {
  // ?etapa=... vem do botão "+" de cada coluna do quadro.
  const { etapa } = await searchParams;
  const stage = isConcursoStageKey(etapa) ? etapa : emptyConcursoFormValues.stage;
  return <ConcursoForm mode="create" defaultValues={{ ...emptyConcursoFormValues, stage }} />;
}

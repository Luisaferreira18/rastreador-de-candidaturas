import { FileSearch, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConcursosNav } from "@/features/concursos/components/concursos-nav";
import { ConcursosTable } from "@/features/concursos/components/concursos-table";
import { NoConcursos } from "@/features/concursos/components/no-concursos";
import { listConcursoSummaries } from "@/features/concursos/queries";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Concursos" };

export default function ConcursosPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Concursos"
        description="Os concursos que você acompanha, com o cronograma, as matérias e a contagem até a prova."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/concursos/ler-edital">
                <FileSearch /> Ler edital
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/concursos/novo">
                <Plus /> Novo concurso
              </Link>
            </Button>
          </>
        }
      />
      <ConcursosNav active="/concursos" />
      <Suspense fallback={<ListSkeleton />}>
        <ListContent />
      </Suspense>
    </div>
  );
}

async function ListContent() {
  const concursos = await listConcursoSummaries();
  if (concursos.length === 0) return <NoConcursos />;
  return <ConcursosTable concursos={concursos} today={todayISO()} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando os concursos">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="space-y-px overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-none" />
        ))}
      </div>
    </div>
  );
}

import { Settings2, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConcursoLeadsView } from "@/features/concursos/components/concurso-leads-view";
import { ConcursoAutoRunner, ConcursoSearchButton } from "@/features/concursos/components/concurso-search-controls";
import { ConcursosNav } from "@/features/concursos/components/concursos-nav";
import { getConcursoSearchData } from "@/features/concursos/search/queries";
import { formatDateTime, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Concursos sugeridos" };

export default function SuggestedConcursosPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Concursos"
        description="Editais abertos que combinam com o seu perfil, buscados todo dia no Diário Oficial da União e nos diários oficiais das suas cidades."
      />
      <ConcursosNav active="/concursos/sugeridos" />
      <Suspense fallback={<SuggestedSkeleton />}>
        <SuggestedContent />
      </Suspense>
    </div>
  );
}

async function SuggestedContent() {
  const { profile, stats, leads } = await getConcursoSearchData();
  if (!profile) {
    return (
      <EmptyState
        icon={Settings2}
        title="Monte seu perfil de concursos"
        description="Diga sua escolaridade, as áreas e os cargos que interessam, as esferas e as cidades. O app busca editais abertos todo dia e dá uma nota para cada um."
      >
        <Button asChild>
          <Link href="/concursos/perfil">Montar perfil</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {profile.auto_search && <ConcursoAutoRunner />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {stats?.finishedAt
            ? `Última busca em ${formatDateTime(stats.finishedAt)}: ${stats.analyzed} ${stats.analyzed === 1 ? "edital olhado" : "editais olhados"}, ${stats.matched} ${stats.matched === 1 ? "combina" : "combinam"} com o perfil.`
            : "Ainda não houve busca com este perfil."}
          {stats && !stats.catalogUpdated && stats.finishedAt && " Os editais vêm da busca diária."}
          {stats && stats.errors.length > 0 && ` Fonte com problema: ${stats.errors.join("; ")}.`}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/concursos/perfil">
              <SlidersHorizontal /> Editar perfil
            </Link>
          </Button>
          <ConcursoSearchButton />
        </div>
      </div>
      <ConcursoLeadsView leads={leads} today={todayISO()} />
      <p className="text-xs text-muted-foreground">
        O app só leva até o site oficial: a inscrição, o pagamento e os documentos ficam sempre com a banca. Concursos estaduais e de
        cidades fora das fontes você cadastra pelo &quot;Novo concurso&quot; ou pelo &quot;Ler edital&quot;.
      </p>
    </div>
  );
}

function SuggestedSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Carregando os concursos sugeridos">
      <Skeleton className="h-8 w-72" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

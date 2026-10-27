import { Radar, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadsView } from "@/features/job-search/components/leads-view";
import { SearchNowButton, SearchStatus } from "@/features/job-search/components/search-controls";
import { getJobSearchData } from "@/features/job-search/queries";
import { formatCurrency, todayISO } from "@/lib/format";
import { jobTypeLabel, workModelLabel } from "@/lib/options";
import type { Tables } from "@/types/database";

export const metadata: Metadata = { title: "Vagas sugeridas" };

export default function JobLeadsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Vagas sugeridas"
        description="Vagas abertas que combinam com o seu perfil, buscadas todo dia na Gupy e nas páginas de carreira de empresas."
      />
      <Suspense fallback={<LeadsSkeleton />}>
        <LeadsContent />
      </Suspense>
    </div>
  );
}

function profileSummary(profile: Tables<"job_profiles">): string {
  const place = [profile.city, profile.state].filter(Boolean).join(", ");
  return [
    profile.roles.join(", "),
    profile.job_types.map(jobTypeLabel).join(", "),
    profile.work_models.map(workModelLabel).join(", ") + (place ? ` · ${place}` : ""),
    profile.min_salary_cents ? `a partir de ${formatCurrency(profile.min_salary_cents)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function LeadsContent() {
  const { profile, stats, leads } = await getJobSearchData();

  if (!profile) {
    return (
      <EmptyState
        icon={Radar}
        title="Monte seu perfil de busca"
        description="Conte que vagas você procura (cargo, cidade, modelo e tipo de vaga). Todo dia o app busca vagas abertas e mostra as mais compatíveis, com o motivo de cada nota."
      >
        <Button asChild>
          <Link href="/vagas/perfil">Montar perfil</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="gap-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">Seu perfil</p>
            <p className="text-sm">{profileSummary(profile)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/vagas/perfil">
                <SlidersHorizontal /> Editar perfil
              </Link>
            </Button>
            <SearchNowButton />
          </div>
        </div>
        <SearchStatus stats={stats} autoSearch={profile.auto_search} />
      </Card>

      <LeadsView leads={leads} today={todayISO()} />
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando as vagas sugeridas">
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}

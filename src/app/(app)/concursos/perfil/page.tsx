import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/features/applications/components/form-skeleton";
import { ConcursoProfileForm } from "@/features/concursos/components/concurso-profile-form";
import { emptyConcursoProfileFormValues, toConcursoProfileFormValues } from "@/features/concursos/search/profile";
import { getConcursoProfile } from "@/features/concursos/search/queries";
import { parseConcursoStats } from "@/features/concursos/search/run";
import type { CityCoverage } from "@/features/concursos/search/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Perfil de concursos" };

const COVERAGE_TEXT: Record<CityCoverage["status"], (item: CityCoverage) => string> = {
  "em-dia": (item) => `diário em dia no Querido Diário (último: ${formatDate(item.lastDate)})`,
  parado: (item) => `o Querido Diário parou de receber os diários desta cidade em ${formatDate(item.lastDate)}`,
  "sem-diarios": () => "listada no Querido Diário, mas sem diários publicados lá",
  "nao-encontrada": () => "fora do Querido Diário: cadastre os concursos pelo \"Ler edital\"",
};

export default function ConcursoProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/concursos/sugeridos">
          <ArrowLeft /> Voltar aos concursos sugeridos
        </Link>
      </Button>
      <PageHeader
        title="Perfil de concursos"
        description="O que você procura. A busca usa este perfil, o Diário Oficial da União e os diários oficiais das suas cidades, sem login em nenhum site."
        className="mb-8"
      />
      <Suspense fallback={<FormSkeleton />}>
        <ProfileForm />
      </Suspense>
    </div>
  );
}

async function ProfileForm() {
  const profile = await getConcursoProfile();
  const coverage = parseConcursoStats(profile?.last_run_stats ?? null)?.coverage ?? [];
  return (
    <div className="space-y-8">
      {coverage.length > 0 && (
        <section className="rounded-xl border bg-card p-4" aria-labelledby="cobertura">
          <h2 id="cobertura" className="mb-2 text-sm font-semibold">
            Suas cidades no Querido Diário
          </h2>
          <ul className="space-y-1 text-sm">
            {coverage.map((item) => (
              <li key={item.place} className="flex gap-2">
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.status === "em-dia" ? "bg-green-500" : "bg-amber-500")}
                />
                <span>
                  <span className="font-medium">{item.place}</span>
                  <span className="text-muted-foreground">: {COVERAGE_TEXT[item.status](item)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ConcursoProfileForm
        isNew={!profile}
        defaultValues={profile ? toConcursoProfileFormValues(profile) : emptyConcursoProfileFormValues}
      />
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSkeleton } from "@/features/applications/components/form-skeleton";
import { ConcursoForm } from "@/features/concursos/components/concurso-form";
import { getConcursoDetail } from "@/features/concursos/queries";
import { toConcursoFormValues } from "@/features/concursos/schema";

export const metadata: Metadata = { title: "Editar concurso" };

export default function EditConcursoPage({ params }: PageProps<"/concursos/[id]/editar">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Suspense
        fallback={
          <>
            <Skeleton className="mb-4 h-7 w-40" />
            <Skeleton className="mb-8 h-8 w-72" />
            <FormSkeleton />
          </>
        }
      >
        <EditConcurso params={params} />
      </Suspense>
    </div>
  );
}

async function EditConcurso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getConcursoDetail(id);
  if (!detail) notFound();
  const { concurso, dates, subjects } = detail;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href={`/concursos/${concurso.id}`}>
          <ArrowLeft /> Voltar para {concurso.organ}
        </Link>
      </Button>
      <PageHeader title="Editar concurso" description={`${concurso.organ} · ${concurso.role_title}`} className="mb-8" />
      <ConcursoForm mode="edit" concursoId={concurso.id} defaultValues={toConcursoFormValues(concurso, dates, subjects)} />
    </>
  );
}

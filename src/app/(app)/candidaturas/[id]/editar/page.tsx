import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { FormSkeleton } from "@/features/applications/components/form-skeleton";
import { getApplicationDetail } from "@/features/applications/queries";
import { toApplicationFormValues } from "@/features/applications/schema";

export const metadata: Metadata = { title: "Editar candidatura" };

export default function EditApplicationPage({ params }: PageProps<"/candidaturas/[id]/editar">) {
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
        <EditApplication params={params} />
      </Suspense>
    </div>
  );
}

async function EditApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getApplicationDetail(id);
  if (!detail) notFound();
  const { application } = detail;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href={`/candidaturas/${application.id}`}>
          <ArrowLeft /> Voltar para {application.company}
        </Link>
      </Button>
      <PageHeader
        title="Editar candidatura"
        description={`${application.company} · ${application.role_title}`}
        className="mb-8"
      />
      <ApplicationForm mode="edit" applicationId={application.id} defaultValues={toApplicationFormValues(application)} />
    </>
  );
}

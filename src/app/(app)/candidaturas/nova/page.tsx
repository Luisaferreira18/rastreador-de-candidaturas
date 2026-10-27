import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { FormSkeleton } from "@/features/applications/components/form-skeleton";
import { emptyApplicationFormValues } from "@/features/applications/schema";
import { todayISO } from "@/lib/format";
import { isStageKey } from "@/lib/stages";

export const metadata: Metadata = { title: "Nova candidatura" };

export default function NewApplicationPage({ searchParams }: PageProps<"/candidaturas/nova">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/quadro">
          <ArrowLeft /> Voltar ao quadro
        </Link>
      </Button>
      <PageHeader
        title="Nova candidatura"
        description="Só empresa e cargo são obrigatórios. O resto você completa quando quiser."
        className="mb-8"
      />
      <Suspense fallback={<FormSkeleton />}>
        <NewApplicationForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewApplicationForm({ searchParams }: { searchParams: PageProps<"/candidaturas/nova">["searchParams"] }) {
  // ?etapa=... vem do botão "+" de cada coluna do quadro.
  const { etapa } = await searchParams;
  const stage = isStageKey(etapa) ? etapa : emptyApplicationFormValues.stage;
  return (
    <ApplicationForm
      mode="create"
      defaultValues={{
        ...emptyApplicationFormValues,
        stage,
        appliedAt: stage === "quero_candidatar" ? "" : todayISO(),
      }}
    />
  );
}

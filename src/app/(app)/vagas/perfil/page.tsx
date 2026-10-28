import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/features/applications/components/form-skeleton";
import { JobProfileForm } from "@/features/job-search/components/job-profile-form";
import { emptyJobProfileFormValues, toJobProfileFormValues } from "@/features/job-search/profile";
import { requireUser } from "@/features/auth/session";
import { getJobProfile } from "@/features/job-search/queries";
import { getResume } from "@/features/resume/queries";

export const metadata: Metadata = { title: "Perfil de busca" };

export default function JobProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/vagas">
          <ArrowLeft /> Voltar às vagas sugeridas
        </Link>
      </Button>
      <PageHeader
        title="Perfil de busca"
        description="O que você procura. A busca usa este perfil, o seu currículo (se enviar) e fontes públicas de vagas, sem login em nenhum site."
        className="mb-8"
      />
      <Suspense fallback={<FormSkeleton />}>
        <ProfileForm />
      </Suspense>
    </div>
  );
}

async function ProfileForm() {
  const [user, profile, resume] = await Promise.all([requireUser(), getJobProfile(), getResume()]);
  return (
    <JobProfileForm
      isNew={!profile}
      defaultValues={profile ? toJobProfileFormValues(profile) : emptyJobProfileFormValues}
      resume={resume}
      isDemo={user.isDemo}
    />
  );
}

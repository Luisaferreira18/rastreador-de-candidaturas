import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  History,
  ListTodo,
  MapPin,
  NotebookPen,
  Pencil,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompanyAvatar } from "@/components/company-avatar";
import { PriorityLabel } from "@/components/priority-indicator";
import { StageBadge } from "@/components/stage-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationActions } from "@/features/applications/components/application-actions";
import { StageTimeline } from "@/features/applications/components/stage-timeline";
import { getApplicationDetail } from "@/features/applications/queries";
import { TaskList } from "@/features/tasks/components/task-list";
import { formatCurrency, formatDate, formatDateTime, todayISO } from "@/lib/format";
import { jobTypeLabel, platformLabel, workModelLabel } from "@/lib/options";
import { getStage } from "@/lib/stages";

export async function generateMetadata({ params }: PageProps<"/candidaturas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getApplicationDetail(id);
  return { title: detail ? `${detail.application.company} · ${detail.application.role_title}` : "Candidatura" };
}

export default function ApplicationPage({ params }: PageProps<"/candidaturas/[id]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/quadro">
          <ArrowLeft /> Voltar ao quadro
        </Link>
      </Button>
      <Suspense fallback={<DetailSkeleton />}>
        <ApplicationDetail params={params} />
      </Suspense>
    </div>
  );
}

function InfoItem({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm break-words">{children}</dd>
      </div>
    </div>
  );
}

async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getApplicationDetail(id);
  if (!detail) notFound();

  const { application, history, tasks } = detail;
  const today = todayISO();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyAvatar name={application.company} className="size-11 rounded-lg text-sm" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{application.company}</h1>
            <p className="text-sm text-muted-foreground">{application.role_title}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <StageBadge stage={application.stage} />
              <PriorityLabel priority={application.priority} className="text-xs text-muted-foreground" />
            </div>
          </div>
        </div>
        <ApplicationActions
          id={application.id}
          company={application.company}
          stage={application.stage}
          stageChangedAt={application.stage_changed_at}
          position={application.position}
          jobUrl={application.job_url}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dados da vaga</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <InfoItem icon={Briefcase} label="Tipo de vaga">
                  {jobTypeLabel(application.job_type)}
                </InfoItem>
                <InfoItem icon={Globe} label="Plataforma">
                  {platformLabel(application.platform)}
                </InfoItem>
                <InfoItem icon={Building2} label="Modelo de trabalho">
                  {workModelLabel(application.work_model)}
                </InfoItem>
                <InfoItem icon={MapPin} label="Local">
                  {application.location ?? <span className="text-muted-foreground">Não informado</span>}
                </InfoItem>
                <InfoItem icon={Wallet} label="Remuneração mensal">
                  {application.salary_cents !== null ? (
                    formatCurrency(application.salary_cents)
                  ) : (
                    <span className="text-muted-foreground">Não informada</span>
                  )}
                </InfoItem>
                <InfoItem icon={CalendarDays} label="Data da candidatura">
                  {application.applied_at ? (
                    formatDate(application.applied_at)
                  ) : (
                    <span className="text-muted-foreground">Ainda não se candidatou</span>
                  )}
                </InfoItem>
                <InfoItem icon={ExternalLink} label="Link da vaga">
                  {application.job_url ? (
                    <a
                      href={application.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {new URL(application.job_url).hostname.replace(/^www\./, "")}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </InfoItem>
              </dl>
              <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
                Criada em {formatDateTime(application.created_at)} · atualizada em{" "}
                {formatDateTime(application.updated_at)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <NotebookPen className="size-4 text-muted-foreground" /> Observações
              </CardTitle>
              <Button variant="ghost" size="xs" asChild>
                <Link href={`/candidaturas/${application.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {application.notes ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{application.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nada anotado ainda. Use este espaço para contatos, impressões das entrevistas e requisitos da vaga.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTodo className="size-4 text-muted-foreground" /> Próximos passos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList parent={{ applicationId: application.id }} tasks={tasks} today={today} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="size-4 text-muted-foreground" /> Linha do tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StageTimeline history={history} today={today} getStage={getStage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Carregando a candidatura">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-5 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

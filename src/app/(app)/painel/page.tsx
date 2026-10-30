import { Activity, Inbox, MessageSquare, Plus, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NoApplications } from "@/features/applications/components/no-applications";
import { getDashboardData, type DashboardData } from "@/features/applications/queries";
import { concursoAgenda } from "@/features/concursos/agenda";
import { ConcursoAgendaCard } from "@/features/dashboard/components/concurso-agenda";
import { ConversionList } from "@/features/dashboard/components/conversion-list";
import { FunnelChart } from "@/features/dashboard/components/funnel-chart";
import { PlatformBars } from "@/features/dashboard/components/platform-bars";
import { StatTile } from "@/features/dashboard/components/stat-tile";
import { UpcomingDeadlines } from "@/features/dashboard/components/upcoming-deadlines";
import { WeeklyChart } from "@/features/dashboard/components/weekly-chart";
import { computeDashboardMetrics, weeklyApplications } from "@/features/dashboard/metrics";
import { formatPercent, pluralize, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Painel" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Painel"
        description="Como está a sua busca por vagas e concursos, em números."
        actions={
          <Button asChild size="sm">
            <Link href="/candidaturas/nova">
              <Plus /> Nova candidatura
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();
  const today = todayISO();
  const concursos =
    data.concursos.length > 0 ? <ConcursoAgendaCard agenda={concursoAgenda(data.concursos, today)} today={today} /> : null;

  if (data.applications.length === 0) {
    if (!concursos) return <NoApplications />;
    return (
      <div className="space-y-6">
        {concursos}
        <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <DeadlinesCard data={data} today={today} />
          <NoApplications />
        </div>
      </div>
    );
  }

  const metrics = computeDashboardMetrics(data.applications, data.history);
  const weekly = weeklyApplications(data.applications, today);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Candidaturas"
          value={String(metrics.total)}
          icon={Inbox}
          detail={`${metrics.sent} enviadas · ${metrics.wishlist} na lista de desejos`}
        />
        <StatTile
          label="Em andamento"
          value={String(metrics.active)}
          icon={Activity}
          detail="Entre a candidatura enviada e a proposta"
        />
        <StatTile
          label="Taxa de resposta"
          value={formatPercent(metrics.responseRate)}
          icon={MessageSquare}
          detail={`${metrics.responded} de ${metrics.sent} enviadas tiveram retorno`}
        />
        <StatTile
          label="Aprovações"
          value={String(metrics.approved)}
          icon={Trophy}
          detail={
            metrics.sent > 0
              ? `${formatPercent(metrics.approvalRate, 1)} das enviadas`
              : "Nenhuma candidatura enviada ainda"
          }
        />
      </div>

      {concursos}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Funil</CardTitle>
              <CardDescription>
                Quantas candidaturas chegaram a cada etapa (ou além). O percentual é sobre as enviadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FunnelChart steps={metrics.funnel} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Aprovação por etapa</CardTitle>
                <CardDescription>Das que chegaram em cada etapa, quantas avançaram.</CardDescription>
              </CardHeader>
              <CardContent>
                <ConversionList steps={metrics.conversion} />
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Por plataforma</CardTitle>
                  <CardDescription>Onde você encontrou as vagas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PlatformBars items={metrics.byPlatform} total={metrics.total} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ritmo semanal</CardTitle>
                  <CardDescription>
                    {pluralize(
                      weekly.reduce((sum, point) => sum + point.count, 0),
                      "candidatura enviada",
                      "candidaturas enviadas",
                    )}{" "}
                    nas últimas 8 semanas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeeklyChart data={weekly} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DeadlinesCard data={data} today={today} className="lg:sticky lg:top-6" />
      </div>
    </div>
  );
}

function DeadlinesCard({ data, today, className }: { data: DashboardData; today: string; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Próximos prazos</CardTitle>
        <CardDescription>Tarefas atrasadas e dos próximos 7 dias, de candidaturas e concursos.</CardDescription>
      </CardHeader>
      <CardContent>
        <UpcomingDeadlines tasks={data.tasks} today={today} />
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Carregando o painel">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

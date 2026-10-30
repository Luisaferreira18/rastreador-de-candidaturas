import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  History,
  Landmark,
  ListTodo,
  MapPin,
  NotebookPen,
  Pencil,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompanyAvatar } from "@/components/company-avatar";
import { PriorityLabel } from "@/components/priority-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StageTimeline } from "@/features/applications/components/stage-timeline";
import { ConcursoActions } from "@/features/concursos/components/concurso-actions";
import { ConcursoStageBadge, SphereBadge } from "@/features/concursos/components/concurso-badges";
import { ScheduleTimeline } from "@/features/concursos/components/schedule-timeline";
import { SubjectList } from "@/features/concursos/components/subject-list";
import { getConcursoDetail } from "@/features/concursos/queries";
import {
  examCountdown,
  examCountdownLabel,
  formatTime,
  registrationLabel,
  registrationStatus,
} from "@/features/concursos/schedule";
import type { ConcursoDate } from "@/features/concursos/types";
import { TaskList } from "@/features/tasks/components/task-list";
import { educationLabel, sphereLabel } from "@/lib/concurso-options";
import { getConcursoStage } from "@/lib/concurso-stages";
import { formatCurrency, formatDateLong, formatDateTime, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { shortHost } from "@/lib/url";

export async function generateMetadata({ params }: PageProps<"/concursos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getConcursoDetail(id);
  return { title: detail ? `${detail.concurso.organ} · ${detail.concurso.role_title}` : "Concurso" };
}

export default function ConcursoPage({ params }: PageProps<"/concursos/[id]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/concursos">
          <ArrowLeft /> Voltar aos concursos
        </Link>
      </Button>
      <Suspense fallback={<DetailSkeleton />}>
        <ConcursoDetail params={params} />
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

const missing = (text: string) => <span className="text-muted-foreground">{text}</span>;

/** Destaque do topo: quantos dias faltam para a prova e como estão as inscrições. */
function Countdown({ dates, today }: { dates: ConcursoDate[]; today: string }) {
  const exam = examCountdown(dates, today);
  const registration = registrationStatus(dates, today);
  const registrationText = registrationLabel(registration);
  if (!exam && !registrationText) return null;
  const closingSoon = registration.status === "abertas" && registration.closesIn !== null && registration.closesIn <= 7;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid sm:grid-cols-[auto_1fr]">
        {exam && (
          <div
            className={cn(
              "flex items-center gap-4 border-b px-5 py-4 sm:border-r sm:border-b-0",
              exam.status === "futura" && exam.days <= 7 ? "bg-amber-500/10" : "bg-primary/5",
            )}
          >
            {exam.status === "futura" ? (
              <p className="text-4xl leading-none font-semibold tracking-tight tabular-nums">
                {exam.days}
                <span className="ml-1 text-base font-medium text-muted-foreground">{exam.days === 1 ? "dia" : "dias"}</span>
              </p>
            ) : (
              <CalendarDays className="size-8 text-primary" strokeWidth={1.75} />
            )}
            <div>
              <p className="text-sm font-medium">{exam.status === "futura" ? "até a prova" : examCountdownLabel(exam)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateLong(exam.date)}
                {formatTime(exam.time) && ` às ${formatTime(exam.time)}`}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center px-5 py-4">
          {registrationText ? (
            <p className={cn("text-sm", closingSoon ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              {registrationText}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem datas de inscrição no cronograma.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

async function ConcursoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getConcursoDetail(id);
  if (!detail) notFound();

  const { concurso, history, dates, subjects, tasks } = detail;
  const today = todayISO();
  const place = [concurso.city, concurso.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyAvatar name={concurso.organ} className="size-11 rounded-lg text-sm" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{concurso.organ}</h1>
            <p className="text-sm text-muted-foreground">{concurso.role_title}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <ConcursoStageBadge stage={concurso.stage} />
              <SphereBadge sphere={concurso.sphere} />
              <PriorityLabel priority={concurso.priority} className="text-xs text-muted-foreground" />
            </div>
          </div>
        </div>
        <ConcursoActions
          id={concurso.id}
          organ={concurso.organ}
          stage={concurso.stage}
          stageChangedAt={concurso.stage_changed_at}
          position={concurso.position}
          noticeUrl={concurso.notice_url}
          registrationUrl={concurso.registration_url}
        />
      </header>

      <Countdown dates={dates} today={today} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-muted-foreground" /> Cronograma
              </CardTitle>
              {dates.length > 0 && (
                <CardAction>
                  <Button variant="ghost" size="sm" asChild className="-my-1.5">
                    <a href={`/api/concursos/agenda?id=${concurso.id}`} download>
                      <CalendarPlus /> Adicionar à agenda
                    </a>
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ScheduleTimeline dates={dates} today={today} />
              {dates.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  &quot;Adicionar à agenda&quot; baixa um arquivo .ics com as datas e lembretes na véspera. No celular, abra o arquivo;
                  no Google Agenda pelo computador, use Configurações › Importar e exportar.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="size-4 text-muted-foreground" /> Matérias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SubjectList concursoId={concurso.id} subjects={subjects} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTodo className="size-4 text-muted-foreground" /> Próximos passos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList
                parent={{ concursoId: concurso.id }}
                tasks={tasks}
                today={today}
                emptyHint='Anote o que precisa fazer, como "pagar o boleto até sexta" ou "pedir a isenção".'
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <NotebookPen className="size-4 text-muted-foreground" /> Observações
              </CardTitle>
              <Button variant="ghost" size="xs" asChild>
                <Link href={`/concursos/${concurso.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {concurso.notes ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{concurso.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nada anotado ainda. Use este espaço para a taxa, o local de prova e os requisitos do cargo.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dados do concurso</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-y-4">
                <InfoItem icon={ClipboardList} label="Banca">
                  {concurso.exam_board ?? missing("Não informada")}
                </InfoItem>
                <InfoItem icon={Landmark} label="Esfera">
                  {sphereLabel(concurso.sphere)}
                  {concurso.area && <span className="text-muted-foreground"> · {concurso.area}</span>}
                </InfoItem>
                <InfoItem icon={GraduationCap} label="Escolaridade exigida">
                  {educationLabel(concurso.education)}
                </InfoItem>
                <InfoItem icon={Wallet} label="Salário inicial">
                  {concurso.salary_cents !== null ? formatCurrency(concurso.salary_cents) : missing("Não informado")}
                </InfoItem>
                <InfoItem icon={Users} label="Vagas">
                  {concurso.vacancies !== null
                    ? `${concurso.vacancies} ${concurso.vacancies === 1 ? "vaga" : "vagas"}${concurso.reserve_list ? " + cadastro reserva" : ""}`
                    : concurso.reserve_list
                      ? "Cadastro reserva"
                      : missing("Não informado")}
                </InfoItem>
                <InfoItem icon={MapPin} label="Local">
                  {place || (concurso.sphere === "federal" ? "Todo o país" : missing("Não informado"))}
                </InfoItem>
                <InfoItem icon={ExternalLink} label="Edital">
                  {concurso.notice_url ? (
                    <a
                      href={concurso.notice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {shortHost(concurso.notice_url)}
                    </a>
                  ) : (
                    missing("Não informado")
                  )}
                </InfoItem>
                <InfoItem icon={Building2} label="Inscrição">
                  {concurso.registration_url ? (
                    <a
                      href={concurso.registration_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {shortHost(concurso.registration_url)}
                    </a>
                  ) : (
                    missing("Não informado")
                  )}
                </InfoItem>
              </dl>
              <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
                Criado em {formatDateTime(concurso.created_at)} · atualizado em {formatDateTime(concurso.updated_at)}
              </p>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="size-4 text-muted-foreground" /> Linha do tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StageTimeline history={history} today={today} getStage={getConcursoStage} createdLabel="adicionado" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Carregando o concurso">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-5 w-36 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

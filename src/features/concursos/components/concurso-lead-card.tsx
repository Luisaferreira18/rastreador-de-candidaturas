"use client";

import { AlertTriangle, CalendarClock, Check, ExternalLink, Loader2, Plus, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CompanyAvatar } from "@/components/company-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreBadge } from "@/features/job-search/components/lead-card";
import { sphereLabel } from "@/lib/concurso-options";
import { formatDate, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { examCountdown, examCountdownLabel, registrationStatus } from "../schedule";
import { dismissConcursoLead, followConcursoLead, restoreConcursoLead } from "../search/actions";
import type { ConcursoLeadWithNotice } from "../search/lead";
import { rowToNotice } from "../search/rows";
import { SOURCE_LABELS } from "../search/types";

/** Um concurso sugerido: por que combina, prazos e o que fazer com ele. */
export function ConcursoLeadCard({ lead, today }: { lead: ConcursoLeadWithNotice; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const notice = rowToNotice(lead.notice);
  const registration = registrationStatus(notice.dates, today);
  const closingSoon = registration.status === "abertas" && registration.closesIn !== null && registration.closesIn <= 7;
  const exam = examCountdown(notice.dates, today);
  const goTo = notice.registrationUrl ?? notice.noticeUrl;
  const place = [notice.city, notice.state].filter(Boolean).join("/");
  const meta = [
    notice.examBoard,
    notice.sphere && sphereLabel(notice.sphere),
    place,
    SOURCE_LABELS[notice.source],
    notice.publishedAt && `publicado ${formatRelativeDay(notice.publishedAt, today)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  function follow() {
    startTransition(async () => {
      const result = await followConcursoLead(lead.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${notice.organ} entrou no quadro`, {
        description: "Em \"Edital publicado\", com o cronograma do edital.",
        action: { label: "Abrir", onClick: () => router.push(`/concursos/${result.data.concursoId}`) },
      });
    });
  }

  function dismiss() {
    startTransition(async () => {
      const result = await dismissConcursoLead(lead.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast("Concurso descartado", {
        description: "Ele não volta nas próximas buscas.",
        action: {
          label: "Desfazer",
          onClick: () => {
            void restoreConcursoLead(lead.id).then((undo) => {
              if (!undo.ok) toast.error(undo.error);
            });
          },
        },
      });
    });
  }

  function restore() {
    startTransition(async () => {
      const result = await restoreConcursoLead(lead.id);
      if (result.ok) toast.success("Concurso de volta na lista de novos.");
      else toast.error(result.error);
    });
  }

  return (
    <Card
      className={cn(
        "flex-row items-start gap-3 p-4 transition-opacity sm:gap-4",
        closingSoon && lead.status === "nova" && "border-amber-500/40 bg-amber-500/[0.03]",
        pending && "opacity-60",
      )}
    >
      <ScoreBadge score={lead.score} />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0 space-y-0.5">
          <p className="line-clamp-2 font-medium">{lead.role ?? notice.title ?? notice.organ}</p>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <CompanyAvatar name={notice.organ} className="size-5 text-[10px]" />
            <span className="truncate font-medium text-foreground/80">{notice.organ}</span>
          </div>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>

        {(closingSoon || registration.status === "em-breve" || exam) && (
          <p
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              closingSoon ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            {registration.status === "abertas" && registration.end
              ? `Inscrições até ${formatDate(registration.end)} (${formatRelativeDay(registration.end, today)})`
              : registration.status === "em-breve"
                ? `Inscrições abrem ${formatRelativeDay(registration.start, today)}`
                : null}
            {exam && exam.status !== "passou" && (
              <span className="text-muted-foreground">
                {registration.status !== "sem-data" && registration.status !== "encerradas" ? " · " : ""}
                {examCountdownLabel(exam)}
              </span>
            )}
          </p>
        )}

        <ul className="flex flex-wrap gap-1.5" aria-label="Por que combina">
          {lead.reasons.map((reason) => (
            <li key={reason} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs">
              <Check className="size-3 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
              <span className="truncate">{reason}</span>
            </li>
          ))}
          {lead.warnings.map((warning) => (
            <li
              key={warning}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{warning}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant={lead.status === "nova" ? "outline" : "ghost"} asChild>
            <a href={goTo} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> {notice.registrationUrl ? "Ir para a inscrição" : "Abrir o edital"}
              <span className="sr-only">(abre o site oficial em outra aba)</span>
            </a>
          </Button>
          {lead.status === "nova" && (
            <>
              <Button size="sm" onClick={follow} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Acompanhar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} disabled={pending}>
                <X /> Descartar
              </Button>
            </>
          )}
          {lead.status === "acompanhando" && lead.concurso_id && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/concursos/${lead.concurso_id}`}>Ver no quadro</Link>
            </Button>
          )}
          {lead.status === "descartada" && (
            <Button size="sm" variant="ghost" onClick={restore} disabled={pending}>
              <Undo2 /> Restaurar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

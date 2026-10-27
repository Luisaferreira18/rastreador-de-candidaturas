"use client";

import { AlertTriangle, Check, ExternalLink, Loader2, Plus, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CompanyAvatar } from "@/components/company-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { diffDaysISO, formatDate, formatRelativeDay, timestampToISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addLeadToBoard, dismissLead, restoreLead } from "../actions";
import { scoreTone, type JobLead } from "../lead";
import { SOURCE_LABELS } from "../types";

const TONE_CLASSES = {
  alta: "bg-green-500/10 text-green-700 ring-green-500/25 dark:text-green-400",
  boa: "bg-primary/10 text-primary ring-primary/20",
  media: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400",
} as const;

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ring-1 ring-inset sm:size-12 sm:text-sm",
        TONE_CLASSES[scoreTone(score)],
        className,
      )}
      title={`${score}% compatível com o seu perfil`}
    >
      {score}%<span className="sr-only"> compatível</span>
    </span>
  );
}

function publishedLabel(publishedAt: string | null, today: string): string | null {
  if (!publishedAt) return null;
  const day = timestampToISODate(publishedAt);
  const age = diffDaysISO(day, today);
  if (age < 0) return null;
  return age <= 30 ? `publicada ${formatRelativeDay(day, today)}` : `publicada em ${formatDate(day)}`;
}

/** Uma vaga sugerida: por que combina e o que fazer com ela. */
export function LeadCard({ lead, today }: { lead: JobLead; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await addLeadToBoard(lead.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${lead.company} foi para "Quero me candidatar"`, {
        description: "A candidatura já tem o link, o local e o tipo de vaga.",
        action: { label: "Abrir", onClick: () => router.push(`/candidaturas/${result.data.applicationId}`) },
      });
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissLead(lead.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast("Vaga descartada", {
        description: "Ela não volta nas próximas buscas.",
        action: {
          label: "Desfazer",
          onClick: () => {
            void restoreLead(lead.id).then((undo) => {
              if (!undo.ok) toast.error(undo.error);
            });
          },
        },
      });
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreLead(lead.id);
      if (result.ok) toast.success("Vaga de volta na lista de novas.");
      else toast.error(result.error);
    });
  }

  const published = publishedLabel(lead.published_at, today);
  const deadlineDays = lead.deadline ? diffDaysISO(today, lead.deadline) : null;
  const meta = [lead.location, SOURCE_LABELS[lead.source], published].filter(Boolean).join(" · ");

  return (
    <Card className={cn("flex-row items-start gap-3 p-4 transition-opacity sm:gap-4", pending && "opacity-60")}>
      <ScoreBadge score={lead.score} />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0 space-y-0.5">
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex max-w-full items-baseline gap-1.5 font-medium outline-none hover:underline focus-visible:underline"
          >
            <span className="line-clamp-2">{lead.title}</span>
            <ExternalLink className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">(abre a vaga em outra aba)</span>
          </a>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <CompanyAvatar name={lead.company} className="size-5 text-[10px]" />
            <span className="truncate font-medium text-foreground/80">{lead.company}</span>
          </div>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>

        <ul className="flex flex-wrap gap-1.5" aria-label="Por que combina">
          {lead.reasons.map((reason) => (
            <li
              key={reason}
              className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
            >
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

        {lead.deadline && deadlineDays !== null && deadlineDays >= 0 && (
          <p className={cn("text-xs", deadlineDays <= 3 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            Inscrições até {formatDate(lead.deadline)} ({formatRelativeDay(lead.deadline, today)})
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {lead.status === "nova" && (
            <>
              <Button size="sm" onClick={handleAdd} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Adicionar ao quadro
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={pending}>
                <X /> Descartar
              </Button>
            </>
          )}
          {lead.status === "adicionada" && lead.application_id && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/candidaturas/${lead.application_id}`}>Ver candidatura</Link>
            </Button>
          )}
          {lead.status === "descartada" && (
            <Button size="sm" variant="ghost" onClick={handleRestore} disabled={pending}>
              <Undo2 /> Restaurar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

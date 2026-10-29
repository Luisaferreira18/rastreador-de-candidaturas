"use client";

import { BookOpen, Check, CheckCheck, Circle } from "lucide-react";
import Link from "next/link";
import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { subjectStatusLabel, type SubjectStatus } from "@/lib/concurso-options";
import { cn } from "@/lib/utils";
import { setSubjectStatus } from "../actions";
import { nextSubjectStatus, subjectProgress, subjectWeight } from "../subjects";
import type { ConcursoSubject } from "../types";

const STATUS_STYLE: Record<SubjectStatus, { icon: typeof Circle; className: string }> = {
  nao_estudado: { icon: Circle, className: "text-muted-foreground" },
  estudado: { icon: Check, className: "text-primary" },
  revisado: { icon: CheckCheck, className: "text-green-600 dark:text-green-400" },
};

/** Barra de progresso: revisadas por cima das estudadas. */
export function SubjectProgressBar({
  studiedPercent,
  reviewedPercent,
  className,
}: {
  studiedPercent: number;
  reviewedPercent: number;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={studiedPercent}
      aria-label={`${studiedPercent}% estudado, ${reviewedPercent}% revisado`}
      className={cn("relative h-2 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary/35" style={{ width: `${studiedPercent}%` }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${reviewedPercent}%` }} />
    </div>
  );
}

/** Matérias da prova: clicar no status passa de "não estudado" para "estudado" e "revisado". */
export function SubjectList({ concursoId, subjects }: { concursoId: string; subjects: ConcursoSubject[] }) {
  const [optimistic, setOptimistic] = useOptimistic(
    subjects,
    (current: ConcursoSubject[], change: { id: string; status: SubjectStatus }) =>
      current.map((subject) => (subject.id === change.id ? { ...subject, status: change.status } : subject)),
  );

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Nenhuma matéria"
        description={
          <>
            Cadastre as matérias do edital{" "}
            <Link href={`/concursos/${concursoId}/editar`} className="text-primary underline-offset-4 hover:underline">
              editando o concurso
            </Link>
            , com o peso ou o número de questões de cada uma.
          </>
        }
        compact
      />
    );
  }

  const progress = subjectProgress(optimistic);

  function cycle(subject: ConcursoSubject) {
    const status = nextSubjectStatus(subject.status);
    startTransition(async () => {
      setOptimistic({ id: subject.id, status });
      const result = await setSubjectStatus({ id: subject.id, status });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">
            {progress.studiedPercent}% estudado
            <span className="font-normal text-muted-foreground"> · {progress.reviewedPercent}% revisado</span>
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {progress.studied} de {progress.total} {progress.total === 1 ? "matéria" : "matérias"}
          </span>
        </div>
        <SubjectProgressBar studiedPercent={progress.studiedPercent} reviewedPercent={progress.reviewedPercent} />
      </div>

      <ul className="divide-y rounded-lg border">
        {optimistic.map((subject) => {
          const style = STATUS_STYLE[subject.status];
          const Icon = style.icon;
          const meta = [
            subject.weight !== null && `peso ${String(subject.weight).replace(".", ",")}`,
            subject.questions !== null && `${subject.questions} questões`,
          ].filter(Boolean);
          return (
            <li key={subject.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", subject.status === "revisado" && "text-muted-foreground")}>{subject.name}</p>
                {meta.length > 0 && <p className="text-xs text-muted-foreground">{meta.join(" · ")}</p>}
              </div>
              <button
                type="button"
                onClick={() => cycle(subject)}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                  style.className,
                )}
                aria-label={`${subject.name}: ${subjectStatusLabel(subject.status)}. Clique para marcar como ${subjectStatusLabel(nextSubjectStatus(subject.status)).toLowerCase()}.`}
                title={`Vale ${subjectWeight(subject)} no progresso`}
              >
                <Icon className="size-3.5" aria-hidden />
                {subjectStatusLabel(subject.status)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

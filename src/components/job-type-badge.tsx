import { jobTypeLabel, type JobType } from "@/lib/options";
import { cn } from "@/lib/utils";

/** Etiqueta neutra com o tipo de vaga (Estágio, CLT, PJ...). */
export function JobTypeBadge({ jobType, className }: { jobType: JobType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {jobTypeLabel(jobType)}
    </span>
  );
}

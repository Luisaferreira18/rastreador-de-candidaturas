import { priorityOption, type Priority } from "@/lib/options";
import { cn } from "@/lib/utils";

/** Barrinhas de sinal (1 a 3) que indicam a prioridade, como no Linear. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const level = priority === "alta" ? 3 : priority === "media" ? 2 : 1;
  const option = priorityOption(priority);
  return (
    <span
      role="img"
      aria-label={`Prioridade ${option.label.toLowerCase()}`}
      className={cn("inline-flex h-3 items-end gap-[2px]", className)}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-[3px] rounded-[1px]",
            bar === 1 ? "h-1" : bar === 2 ? "h-2" : "h-3",
            bar <= level ? option.dot : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

export function PriorityLabel({ priority, className }: { priority: Priority; className?: string }) {
  const option = priorityOption(priority);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <PriorityIcon priority={priority} />
      {option.label}
    </span>
  );
}

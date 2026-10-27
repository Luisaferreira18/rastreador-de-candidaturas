import { cn } from "@/lib/utils";

/** Marca do app: três colunas de um quadro Kanban em alturas diferentes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 items-end justify-center gap-[3px] rounded-lg bg-primary p-1.5 shadow-sm",
        className,
      )}
    >
      <span className="h-3.5 w-[3px] rounded-full bg-primary-foreground/95" />
      <span className="h-2.5 w-[3px] rounded-full bg-primary-foreground/70" />
      <span className="h-4 w-[3px] rounded-full bg-primary-foreground/95" />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>Rastreador</span>
    </span>
  );
}

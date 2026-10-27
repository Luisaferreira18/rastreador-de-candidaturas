import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vazio com ícone, mensagem e ações. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16",
        className,
      )}
    >
      {/* Grade pontilhada sutil ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl border bg-background shadow-sm",
          compact ? "size-10" : "size-14",
        )}
      >
        <Icon className={cn("text-primary", compact ? "size-5" : "size-6")} strokeWidth={1.75} />
      </div>
      <div className="relative max-w-sm space-y-1">
        <h3 className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="relative mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300",
  "bg-orange-500/12 text-orange-700 dark:text-orange-300",
  "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
];

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Quadradinho com as iniciais da empresa, sempre na mesma cor para o mesmo nome. */
export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
        PALETTE[hash(name.toLowerCase()) % PALETTE.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}

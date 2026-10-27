"use client";

import { cn } from "@/lib/utils";

/** Grupo de opções lado a lado (como botões de rádio), acessível pelo teclado. */
export function SegmentedControl<T extends string>({
  id,
  value,
  options,
  onChange,
  label,
  className,
}: {
  id?: string;
  value: T;
  options: readonly { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.value);
    const container = (event.currentTarget as HTMLElement).parentElement;
    (container?.children[(index + delta + options.length) % options.length] as HTMLElement | undefined)?.focus();
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex h-8 w-full rounded-lg border bg-muted/40 p-0.5", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "bg-background text-foreground shadow-xs ring-1 ring-border" : "hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

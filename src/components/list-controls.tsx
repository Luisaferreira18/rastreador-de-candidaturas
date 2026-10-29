"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ALL = "todas";

/** Filtro em forma de seleção ("Todas as etapas", "Federal"...), usado nas listas. */
export function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  allLabel: string;
  options: readonly { value: string; label: string; dot?: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn("w-full min-w-0 sm:w-auto sm:min-w-36", value && "border-primary/40 bg-primary/5")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.dot && <span aria-hidden className={cn("size-2 rounded-full", option.dot)} />}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Cabeçalho de coluna que ordena a tabela ao clicar. */
export function SortableHead({
  label,
  active,
  direction,
  onSort,
  className,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "-ml-2 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-accent",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

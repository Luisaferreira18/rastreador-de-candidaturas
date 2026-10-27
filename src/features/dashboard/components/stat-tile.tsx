import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Número de destaque do painel: rótulo, valor e uma linha de contexto. */
export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground/70" strokeWidth={1.75} />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

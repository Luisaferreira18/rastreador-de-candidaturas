"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setAutoApply } from "../actions";

export function AutoApplyToggle({ enabled }: { enabled: boolean }) {
  const id = useId();
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={optimistic}
        className="mt-0.5"
        onCheckedChange={(checked) =>
          startTransition(async () => {
            setOptimistic(checked === true);
            const result = await setAutoApply(checked === true);
            if (!result.ok) toast.error(result.error);
          })
        }
      />
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="font-medium">Aplicar sozinho quando tiver certeza</span>
        <span className="block text-xs text-muted-foreground">
          Confirmações de inscrição e reprovações com frase clara. O resto espera a sua confirmação.
        </span>
      </label>
    </div>
  );
}

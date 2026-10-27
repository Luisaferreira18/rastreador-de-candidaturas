"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInAsDemo } from "../actions";

/** Entra na conta de demonstração com um clique (as credenciais ficam só no servidor). */
export function DemoButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await signInAsDemo();
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      Explorar a demonstração
    </Button>
  );
}

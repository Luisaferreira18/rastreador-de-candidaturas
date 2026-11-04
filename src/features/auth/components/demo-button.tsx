"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signInAsDemo } from "../actions";

/** Entra na conta de demonstração com um clique (as credenciais ficam só no servidor). */
export function DemoButton({
  variant = "secondary",
  size,
  className,
}: {
  variant?: "default" | "secondary";
  size?: "default" | "lg";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("w-full", className)}
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

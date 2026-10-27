"use client";

import { ClipboardPaste, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzePastedMessage } from "../actions";

/**
 * "Colar mensagem": para WhatsApp, LinkedIn ou qualquer e-mail. O texto vira
 * uma sugestão na caixa de entrada para você conferir e aplicar.
 * Abre sozinho com ?colar=1 (atalho da paleta de comandos).
 */
export function PasteMessageDialog() {
  const searchParams = useSearchParams();
  const uid = useId();
  const [open, setOpen] = useState(searchParams.get("colar") === "1");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzePastedMessage(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setText("");
      if (result.data.relevant) toast.success("Sugestão criada. Confira e aplique logo abaixo.");
      else toast.info("Não reconheci uma etapa nessa mensagem. Ajuste a sugestão antes de aplicar.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardPaste /> Colar mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Colar mensagem de recrutador</DialogTitle>
          <DialogDescription>
            Copie a mensagem do WhatsApp, LinkedIn ou e-mail e cole aqui. O app identifica a empresa, a etapa e as
            datas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-text`} className="sr-only">
            Mensagem
          </Label>
          <Textarea
            id={`${uid}-text`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) handleAnalyze();
            }}
            rows={8}
            autoFocus
            placeholder={'Ex.: "Oi! Aqui é a Júlia, do RH da Trilha Mobilidade. Você passou para a próxima fase! Podemos marcar uma entrevista dia 23/10 às 15h?"'}
            aria-invalid={error ? true : undefined}
            disabled={pending}
          />
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleAnalyze} disabled={pending || text.trim().length === 0}>
            {pending && <Loader2 className="animate-spin" />}
            Analisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { CheckCircle2, Loader2, MessageCircle, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { getWhatsAppStatus, startWhatsAppLink, unlinkWhatsApp, type WhatsAppStatus } from "../actions";

const EXAMPLES = ["resumo", "prazos", "andamento", "vagas", "Nuvem Pay"];

export function ConnectWhatsApp({
  enabled,
  status: initialStatus,
  isDemo,
}: {
  enabled: boolean;
  status: WhatsAppStatus;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [link, setLink] = useState<{ code: string; link: string; expiresAt: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Enquanto o código está valendo, confere a cada 3 s se a pessoa já mandou a mensagem.
  useEffect(() => {
    if (!link || status.linked) return;
    const timer = window.setInterval(async () => {
      if (Date.now() > new Date(link.expiresAt).getTime()) {
        window.clearInterval(timer);
        setLink(null);
        toast.info("O código expirou. Gere outro quando quiser.");
        return;
      }
      const result = await getWhatsAppStatus();
      if (result.ok && result.data.linked) {
        window.clearInterval(timer);
        setStatus(result.data);
        setLink(null);
        toast.success("WhatsApp conectado!");
        router.refresh();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [link, status.linked, router]);

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        O assistente de WhatsApp ainda não foi configurado neste site. Quem publica o app precisa criar o número na
        Meta (grátis) e preencher as variáveis do WhatsApp, como explica o README.
      </p>
    );
  }

  if (status.linked) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
          Conectado ao número <strong>{status.phone}</strong>
          {status.linkedAt && <span className="text-muted-foreground">desde {formatDateTime(status.linkedAt)}</span>}
        </p>
        <p className="text-sm text-muted-foreground">
          Mande para o assistente: {EXAMPLES.map((example) => `"${example}"`).join(", ")}. Ou encaminhe uma mensagem de
          recrutador para virar sugestão na caixa de entrada.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await unlinkWhatsApp();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setStatus({ linked: false, phone: null, linkedAt: null });
              toast.success("WhatsApp desconectado.");
            })
          }
        >
          <Unlink /> Desconectar
        </Button>
      </div>
    );
  }

  if (link) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Abra o WhatsApp no celular e envie a mensagem abaixo para o assistente. Ela prova que o número é seu.
        </p>
        <p className="w-fit rounded-lg border bg-muted/40 px-3 py-2 font-mono text-base font-semibold tracking-wide">
          vincular {link.code}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <a href={link.link} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Abrir o WhatsApp
            </a>
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Esperando a sua mensagem (o código vale 15 minutos)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button
        disabled={pending || isDemo}
        onClick={() =>
          startTransition(async () => {
            const result = await startWhatsAppLink();
            if (result.ok) setLink(result.data);
            else toast.error(result.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
        Conectar WhatsApp
      </Button>
      <p className="text-xs text-muted-foreground">
        {isDemo
          ? "Na conta de demonstração esta opção fica desligada."
          : "Você recebe um código e manda para o assistente pelo seu WhatsApp. Leva menos de um minuto."}
      </p>
    </div>
  );
}

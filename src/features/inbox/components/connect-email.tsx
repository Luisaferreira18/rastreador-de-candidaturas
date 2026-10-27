"use client";

import { Check, Copy, ExternalLink, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateInboxToken } from "../actions";
import { DEFAULT_REPORT_HOUR, buildAppsScript } from "../apps-script";

const HOURS = [6, 7, 8, 9, 10, 12, 18, 20];
const OFF = "desligado";

/** Gera o token e mostra o script do Google pronto para copiar. */
export function ConnectEmail({ hasToken, isDemo }: { hasToken: boolean; isDemo: boolean }) {
  const uid = useId();
  const [hour, setHour] = useState(String(DEFAULT_REPORT_HOUR));
  const [script, setScript] = useState<string | null>(null);
  const [site, setSite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateInboxToken();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const origin = window.location.origin;
      setSite(origin);
      setScript(
        buildAppsScript({ site: origin, token: result.data.token, reportHour: hour === OFF ? null : Number(hour) }),
      );
      setCopied(false);
    });
  }

  async function handleCopy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      toast.success("Script copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie manualmente.");
    }
  }

  const isLocal = site !== null && /localhost|127\.0\.0\.1/.test(site);

  if (script) {
    return (
      <div className="space-y-3">
        {isLocal && (
          <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              Você está em <strong>localhost</strong>: o Google não consegue falar com o seu computador. Gere o script
              de novo no endereço publicado (Vercel) para ele funcionar de verdade.
            </span>
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Seu script (o token aparece só agora: copie antes de sair da página)</p>
          <Button size="sm" variant={copied ? "outline" : "default"} onClick={handleCopy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiado" : "Copiar script"}
          </Button>
        </div>
        <pre className="scrollbar-thin max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {script}
        </pre>
        <Button variant="outline" size="sm" asChild>
          <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Abrir o Google Apps Script
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor={`${uid}-hour`} className="text-xs text-muted-foreground">
          Resumo diário no Gmail
        </Label>
        <Select value={hour} onValueChange={setHour} disabled={pending || isDemo}>
          <SelectTrigger id={`${uid}-hour`} size="sm" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                Todo dia às {value}h
              </SelectItem>
            ))}
            <SelectItem value={OFF}>Não quero o resumo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleGenerate} disabled={pending || isDemo}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {hasToken ? "Gerar novo script" : "Gerar meu script"}
      </Button>
      <p className="text-xs text-muted-foreground sm:pb-2">
        {isDemo
          ? "Na conta de demonstração esta opção fica desligada."
          : hasToken
            ? "Gerar de novo desativa o script anterior."
            : "O script já sai com o seu token pessoal dentro."}
      </p>
    </div>
  );
}

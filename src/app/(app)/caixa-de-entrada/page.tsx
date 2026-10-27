import { CheckCheck, ClipboardPaste, Mail, MailCheck, MailPlus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoApplyToggle } from "@/features/inbox/components/auto-apply-toggle";
import { PasteMessageDialog } from "@/features/inbox/components/paste-message-dialog";
import { SuggestionCard } from "@/features/inbox/components/suggestion-card";
import { getInboxData } from "@/features/inbox/queries";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Caixa de entrada" };

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Caixa de entrada"
        description="Sugestões criadas a partir dos seus e-mails e das mensagens que você cola. Confira e aplique com um clique."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/conexoes#email">
                <MailPlus /> Conectar e-mail
              </Link>
            </Button>
            <Suspense fallback={<Skeleton className="h-7 w-36" />}>
              <PasteMessageDialog />
            </Suspense>
          </>
        }
      />
      <Suspense fallback={<InboxSkeleton />}>
        <InboxContent />
      </Suspense>
    </div>
  );
}

async function InboxContent() {
  const { pending, history, applications, settings } = await getInboxData();

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              settings.hasToken ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground",
            )}
          >
            {settings.hasToken ? <MailCheck className="size-4" /> : <Mail className="size-4" />}
          </span>
          <div className="text-sm">
            <p className="font-medium">{settings.hasToken ? "E-mail conectado" : "E-mail não conectado"}</p>
            <p className="text-xs text-muted-foreground">
              {settings.hasToken
                ? settings.lastEmailAt
                  ? `Última mensagem recebida em ${formatDateTime(settings.lastEmailAt)}`
                  : "Nenhuma mensagem recebida ainda. O script confere o Gmail a cada 10 minutos."
                : "Conecte o Gmail para as respostas das empresas chegarem sozinhas (grátis)."}
            </p>
          </div>
        </div>
        <AutoApplyToggle enabled={settings.autoApply} />
      </Card>

      <section aria-labelledby="pendentes" className="space-y-3">
        <h2 id="pendentes" className="flex items-center gap-2 text-sm font-semibold">
          Para conferir
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary tabular-nums">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCheck}
            title="Tudo em dia"
            description="Quando chegar um e-mail de processo seletivo, ou quando você colar uma mensagem, a sugestão aparece aqui."
            compact
          >
            {!settings.hasToken && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/conexoes#email">
                  <MailPlus /> Conectar e-mail
                </Link>
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {pending.map((item) => (
              <SuggestionCard key={item.id} item={item} applications={applications} />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="resolvidas" className="space-y-3">
          <h2 id="resolvidas" className="text-sm font-semibold">
            Já resolvidas
          </h2>
          <ul className="divide-y rounded-xl border">
            {history.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {item.source === "email" ? (
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ClipboardPaste className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate", item.status === "ignorada" && "text-muted-foreground line-through")}>
                    {item.status === "ignorada" ? item.subject || "Mensagem ignorada" : item.resolution}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.subject} · {formatDateTime(item.received_at)}
                  </p>
                </div>
                {item.auto_applied && (
                  <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary sm:inline-flex">
                    <Sparkles className="size-3" /> automático
                  </span>
                )}
                {item.application_id && (
                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/candidaturas/${item.application_id}`}>Ver</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando a caixa de entrada">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

import { CalendarClock, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, requireUser } from "@/features/auth/session";
import { ConnectEmail } from "@/features/inbox/components/connect-email";
import { getInboxData } from "@/features/inbox/queries";
import { buildDailyReport } from "@/features/report/build";
import { loadSnapshotForUser } from "@/features/report/load";
import { renderReportEmail } from "@/features/report/render";
import { getWhatsAppStatus } from "@/features/whatsapp/actions";
import { ConnectWhatsApp } from "@/features/whatsapp/components/connect-whatsapp";
import { getWhatsAppConfig } from "@/features/whatsapp/config";
import { formatDateTime, todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conexões" };

const EMAIL_STEPS = [
  "Escolha o horário do resumo e clique em gerar. O script já vem com um token pessoal, que só funciona para a sua conta.",
  'Abra script.google.com, clique em "Novo projeto", apague o que estiver lá, cole o script e salve (Ctrl+S).',
  'No topo, escolha "configurar" e clique em "Executar". O Google pede autorização para ler o Gmail e enviar e-mails: como o script é seu, ele avisa "app não verificado". Clique em "Avançado" e depois em "Acessar".',
  "Pronto: os e-mails dos últimos 14 dias entram na hora, o Gmail é conferido a cada 10 minutos e o resumo chega todo dia no horário escolhido.",
];

export default function ConnectionsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Conexões"
        description="Respostas das empresas chegando sozinhas, um resumo por dia e um assistente no WhatsApp. Tudo grátis."
      />

      <Card id="email">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" /> E-mail (Gmail)
          </CardTitle>
          <CardDescription>
            Um script do Google, rodando na sua própria conta, envia os e-mails de processos seletivos para a caixa de
            entrada do app e manda o resumo diário para você.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Suspense fallback={<Skeleton className="h-5 w-64" />}>
            <EmailStatus />
          </Suspense>
          <ol className="space-y-3">
            {EMAIL_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <Suspense fallback={<Skeleton className="h-9 w-72" />}>
            <EmailConnect />
          </Suspense>
        </CardContent>
      </Card>

      <Card id="whatsapp">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-muted-foreground" /> WhatsApp
          </CardTitle>
          <CardDescription>
            Pergunte ao assistente quando quiser: “resumo”, “prazos”, “andamento” ou o nome de uma empresa. Encaminhe para
            ele mensagens de recrutadores e elas viram sugestões. Ele só responde quando você escreve, e por isso é grátis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-9 w-48" />}>
            <WhatsAppSection />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" /> Prévia do resumo de hoje
          </CardTitle>
          <CardDescription>É este e-mail que chega todo dia no horário escolhido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <ReportPreview />
          </Suspense>
        </CardContent>
      </Card>

      <div className="flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
        <p className="text-muted-foreground">
          <strong className="font-medium text-foreground">Privacidade:</strong> o script só envia e-mails de plataformas de
          recrutamento ou com assunto de processo seletivo, e o app guarda apenas um trecho de cada um. O assistente do
          WhatsApp só responde ao número que você conectou com o código. Para desligar o e-mail, rode a função{" "}
          <code className="font-mono text-xs">desligar</code> no script; para o WhatsApp, use o botão Desconectar ou
          mande “desvincular”.
        </p>
      </div>
    </div>
  );
}

async function EmailStatus() {
  const { settings } = await getInboxData();
  return (
    <p className="text-sm">
      {settings.hasToken ? (
        <>
          <span className="font-medium text-green-700 dark:text-green-400">Conectado.</span>{" "}
          <span className="text-muted-foreground">
            {settings.lastEmailAt
              ? `Última mensagem recebida em ${formatDateTime(settings.lastEmailAt)}.`
              : "Nenhuma mensagem recebida ainda."}{" "}
            Se você conectou antes do resumo diário existir, gere o script de novo para recebê-lo.
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">Ainda não conectado.</span>
      )}
    </p>
  );
}

async function EmailConnect() {
  const [user, data] = await Promise.all([getCurrentUser(), getInboxData()]);
  return <ConnectEmail hasToken={data.settings.hasToken} isDemo={Boolean(user?.isDemo)} />;
}

async function WhatsAppSection() {
  const user = await getCurrentUser();
  const enabled = getWhatsAppConfig() !== null;
  const status = enabled ? await getWhatsAppStatus() : null;
  return (
    <ConnectWhatsApp
      enabled={enabled}
      isDemo={Boolean(user?.isDemo)}
      status={status?.ok ? status.data : { linked: false, phone: null, linkedAt: null }}
    />
  );
}

async function ReportPreview() {
  const user = await requireUser();
  const supabase = await createClient();
  const report = buildDailyReport(await loadSnapshotForUser(supabase, user.id), todayISO());
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const { html } = renderReportEmail(report, appUrl);
  return (
    <iframe
      title="Prévia do resumo diário"
      srcDoc={html}
      sandbox=""
      className="h-[560px] w-full rounded-lg border bg-white"
    />
  );
}

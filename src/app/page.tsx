import { CalendarClock, KanbanSquare, Landmark, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DemoButton } from "@/features/auth/components/demo-button";
import { AppPrint } from "@/features/landing/app-print";
import { getDemoCredentials } from "@/lib/env";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Rastreador de candidaturas: vagas e concursos num lugar só" },
  alternates: { canonical: "/" },
};

const REPOSITORY_URL = "https://github.com/Luisaferreira18/rastreador-de-candidaturas";

const FEATURES = [
  {
    icon: KanbanSquare,
    title: "Cada candidatura no seu lugar",
    text: "Arraste a vaga entre as etapas no quadro. A mudança entra na linha do tempo, e os próximos passos com prazo não passam batido.",
    print: "quadro",
    alt: "Quadro Kanban com candidaturas separadas por etapa",
  },
  {
    icon: Sparkles,
    title: "Vagas sugeridas todo dia",
    text: "Diga o que você procura ou envie o currículo. O app busca vagas abertas, dá uma nota de compatibilidade e mostra os motivos de cada uma.",
    print: "vagas",
    alt: "Lista de vagas sugeridas com nota de compatibilidade e motivos",
  },
  {
    icon: Landmark,
    title: "Concursos do edital à prova",
    text: "Cole o edital e o app preenche órgão, cargo e cronograma. Acompanhe a contagem até a prova, as matérias e os editais novos do Diário Oficial.",
    print: "concurso",
    alt: "Página de um concurso com contagem até a prova e cronograma",
  },
] as const;

function Actions({ showDemo, className }: { showDemo: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col justify-center gap-3 sm:flex-row", className)}>
      {showDemo && <DemoButton variant="default" size="lg" className="sm:w-auto" />}
      <Button variant={showDemo ? "outline" : "default"} size="lg" className="w-full sm:w-auto" asChild>
        <Link href="/cadastro" prefetch={false}>
          Criar conta
        </Link>
      </Button>
    </div>
  );
}

/** Página pública. Quem já entrou nem chega aqui: o proxy leva direto ao painel. */
export default function LandingPage() {
  const showDemo = getDemoCredentials() !== null;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Conta" className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login" prefetch={false}>
              Entrar
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Sua busca por vagas e concursos, organizada
            </h1>
            <p className="mt-4 text-lg text-pretty text-muted-foreground">
              Acompanhe cada candidatura e cada edital num lugar só, com etapas, prazos e sugestões novas todo dia.
            </p>
            <Actions showDemo={showDemo} className="mt-8" />
            {showDemo && (
              <p className="mt-3 text-sm text-muted-foreground">A demonstração não pede cadastro e já vem com dados de exemplo.</p>
            )}
          </div>
          <AppPrint
            name="painel"
            alt="Painel com o total de candidaturas, a agenda dos concursos e o funil"
            sizes="(min-width: 1152px) 1104px, (min-width: 640px) 100vw, 640px"
            priority
            className="mt-12"
          />
        </section>

        <div className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16 sm:space-y-24 sm:px-6 sm:py-24">
            {FEATURES.map((feature, index) => (
              <section
                key={feature.print}
                className={cn(
                  "grid items-center gap-8 lg:gap-12",
                  index % 2 === 1 ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
                )}
              >
                <div className={cn(index % 2 === 1 && "lg:order-last")}>
                  <span className="mb-4 flex size-10 items-center justify-center rounded-lg border bg-background">
                    <feature.icon aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight">{feature.title}</h2>
                  <p className="mt-3 text-pretty text-muted-foreground">{feature.text}</p>
                </div>
                <AppPrint name={feature.print} alt={feature.alt} sizes="(min-width: 1024px) 640px, (min-width: 640px) 100vw, 640px" />
              </section>
            ))}
          </div>
        </div>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-lg border bg-background">
            <CalendarClock aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">Comece pelo que está mais perto do prazo</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            É grátis. Dá para explorar tudo antes de cadastrar a primeira vaga.
          </p>
          <Actions showDemo={showDemo} className="mt-8" />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>Na demonstração, candidaturas e concursos são fictícios. As vagas sugeridas vêm da busca real.</p>
          <a href={REPOSITORY_URL} className="underline-offset-4 hover:text-foreground hover:underline">
            Código aberto no GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

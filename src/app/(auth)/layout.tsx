import { CalendarClock, KanbanSquare, LineChart } from "lucide-react";
import { Logo } from "@/components/logo";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: KanbanSquare, text: "Quadro Kanban: arraste a vaga e a etapa muda na hora" },
  { icon: CalendarClock, text: "Próximos passos com prazo, para nada passar batido" },
  { icon: LineChart, text: "Funil e taxa de resposta para saber onde melhorar" },
];

/** Miniatura decorativa de um quadro, no painel ao lado do formulário. */
function BoardPreview() {
  const columns = [
    { stage: STAGES[1], cards: [72, 54, 64] },
    { stage: STAGES[4], cards: [60, 80] },
    { stage: STAGES[6], cards: [68] },
  ];
  return (
    <div aria-hidden className="grid grid-cols-3 gap-2.5">
      {columns.map(({ stage, cards }) => (
        <div key={stage.key} className={cn("space-y-2 rounded-xl p-2", stage.column)}>
          <div className="flex items-center gap-1.5 px-1">
            <span className={cn("size-1.5 rounded-full", stage.dot)} />
            <span className="truncate text-[10px] font-medium text-foreground/70">{stage.shortLabel}</span>
          </div>
          {cards.map((width, index) => (
            <div key={index} className="space-y-1.5 rounded-lg border bg-card p-2 shadow-xs">
              <div className="h-1.5 rounded-full bg-foreground/15" style={{ width: `${width}%` }} />
              <div className="h-1.5 w-1/2 rounded-full bg-foreground/8" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
        />
        <Logo className="relative text-lg" />
        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Sua busca por vagas, organizada do primeiro clique à proposta.
            </h2>
            <p className="text-muted-foreground">
              Registre cada candidatura, acompanhe as etapas e veja o que está funcionando.
            </p>
          </div>
          <BoardPreview />
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
                  <feature.icon className="size-4 text-primary" strokeWidth={1.75} />
                </span>
                {feature.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Feito com Next.js, Supabase e muito café.</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Logo className="mb-10 lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  );
}

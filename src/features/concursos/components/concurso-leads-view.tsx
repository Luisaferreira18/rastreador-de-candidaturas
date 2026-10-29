"use client";

import { Archive, Landmark, Radar } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { registrationStatus } from "../schedule";
import type { ConcursoLeadWithNotice } from "../search/lead";
import { rowToNotice } from "../search/rows";
import { ConcursoLeadCard } from "./concurso-lead-card";
import { ConcursoSearchButton } from "./concurso-search-controls";

function Count({ value }: { value: number }) {
  return <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{value}</span>;
}

/** Inscrição terminando em até 7 dias? Esses vêm primeiro, em destaque. */
function closesSoon(lead: ConcursoLeadWithNotice, today: string): string | null {
  const status = registrationStatus(rowToNotice(lead.notice).dates, today);
  return status.status === "abertas" && status.end && status.closesIn !== null && status.closesIn <= 7 ? status.end : null;
}

/** Abas Novos / Acompanhando / Descartados. */
export function ConcursoLeadsView({
  leads,
  today,
}: {
  leads: { nova: ConcursoLeadWithNotice[]; acompanhando: ConcursoLeadWithNotice[]; descartada: ConcursoLeadWithNotice[] };
  today: string;
}) {
  const urgent = leads.nova
    .map((lead) => ({ lead, end: closesSoon(lead, today) }))
    .filter((item): item is { lead: ConcursoLeadWithNotice; end: string } => item.end !== null)
    .sort((a, b) => a.end.localeCompare(b.end))
    .map((item) => item.lead);
  const others = leads.nova.filter((lead) => !urgent.includes(lead));

  return (
    <Tabs defaultValue="nova" className="gap-4">
      <TabsList>
        <TabsTrigger value="nova">
          Novos <Count value={leads.nova.length} />
        </TabsTrigger>
        <TabsTrigger value="acompanhando">
          Acompanhando <Count value={leads.acompanhando.length} />
        </TabsTrigger>
        <TabsTrigger value="descartada">
          Descartados <Count value={leads.descartada.length} />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="nova" className="space-y-3">
        {leads.nova.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="Nenhum concurso novo por enquanto"
            description="A busca roda todo dia no Diário Oficial da União e nos diários das suas cidades. Para ver mais opções, inclua outras áreas, cidades ou esferas no perfil."
            compact
          >
            <ConcursoSearchButton />
            <Button size="sm" variant="ghost" asChild>
              <Link href="/concursos/perfil">Ajustar perfil</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            {urgent.length > 0 && (
              <section aria-label="Inscrições terminando nos próximos 7 dias" className="space-y-3">
                <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Inscrições terminando nos próximos 7 dias</h2>
                {urgent.map((lead) => (
                  <ConcursoLeadCard key={lead.id} lead={lead} today={today} />
                ))}
                {others.length > 0 && <h2 className="pt-2 text-sm font-semibold">Outros concursos</h2>}
              </section>
            )}
            {others.map((lead) => (
              <ConcursoLeadCard key={lead.id} lead={lead} today={today} />
            ))}
          </>
        )}
      </TabsContent>

      <TabsContent value="acompanhando" className="space-y-3">
        {leads.acompanhando.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Nenhum concurso acompanhado daqui ainda"
            description='Use "Acompanhar" num concurso novo: ele entra no quadro em "Edital publicado", com o cronograma.'
            compact
          />
        ) : (
          leads.acompanhando.map((lead) => <ConcursoLeadCard key={lead.id} lead={lead} today={today} />)
        )}
      </TabsContent>

      <TabsContent value="descartada" className="space-y-3">
        {leads.descartada.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nada descartado"
            description="Concursos descartados ficam aqui e não voltam nas próximas buscas."
            compact
          />
        ) : (
          leads.descartada.map((lead) => <ConcursoLeadCard key={lead.id} lead={lead} today={today} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

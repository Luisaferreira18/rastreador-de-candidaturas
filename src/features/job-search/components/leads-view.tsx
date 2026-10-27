"use client";

import { Archive, BriefcaseBusiness, Radar } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JobLead } from "../lead";
import { LeadCard } from "./lead-card";
import { SearchNowButton } from "./search-controls";

function Count({ value }: { value: number }) {
  return <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{value}</span>;
}

/** Abas Novas / Adicionadas / Descartadas. */
export function LeadsView({
  leads,
  today,
}: {
  leads: { nova: JobLead[]; adicionada: JobLead[]; descartada: JobLead[] };
  today: string;
}) {
  return (
    <Tabs defaultValue="nova" className="gap-4">
      <TabsList>
        <TabsTrigger value="nova">
          Novas <Count value={leads.nova.length} />
        </TabsTrigger>
        <TabsTrigger value="adicionada">
          Adicionadas <Count value={leads.adicionada.length} />
        </TabsTrigger>
        <TabsTrigger value="descartada">
          Descartadas <Count value={leads.descartada.length} />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="nova" className="space-y-3">
        {leads.nova.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="Nenhuma vaga nova por enquanto"
            description="A busca roda todo dia. Se quiser mais opções, inclua outros cargos ou aceite mais modelos de trabalho no perfil."
            compact
          >
            <SearchNowButton />
            <Button size="sm" variant="ghost" asChild>
              <Link href="/vagas/perfil">Ajustar perfil</Link>
            </Button>
          </EmptyState>
        ) : (
          leads.nova.map((lead) => <LeadCard key={lead.id} lead={lead} today={today} />)
        )}
      </TabsContent>

      <TabsContent value="adicionada" className="space-y-3">
        {leads.adicionada.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="Nenhuma vaga adicionada ainda"
            description='Use "Adicionar ao quadro" numa vaga nova: ela entra em "Quero me candidatar".'
            compact
          />
        ) : (
          leads.adicionada.map((lead) => <LeadCard key={lead.id} lead={lead} today={today} />)
        )}
      </TabsContent>

      <TabsContent value="descartada" className="space-y-3">
        {leads.descartada.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nada descartado"
            description="Vagas descartadas ficam aqui e não voltam nas próximas buscas."
            compact
          />
        ) : (
          leads.descartada.map((lead) => <LeadCard key={lead.id} lead={lead} today={today} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

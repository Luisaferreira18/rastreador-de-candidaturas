"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { WeeklyPoint } from "../metrics";

const chartConfig = {
  count: { label: "Candidaturas enviadas", color: "var(--chart-accent)" },
} satisfies ChartConfig;

/** Colunas com quantas candidaturas foram enviadas em cada semana. */
export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <>
    {/* Versão em tabela para leitores de tela (o gráfico em si é só visual). */}
    <table className="sr-only">
      <caption>Candidaturas enviadas por semana</caption>
      <thead>
        <tr>
          <th scope="col">Semana de</th>
          <th scope="col">Enviadas</th>
        </tr>
      </thead>
      <tbody>
        {data.map((point) => (
          <tr key={point.weekStart}>
            <td>{point.label}</td>
            <td>{point.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full" aria-hidden>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} fontSize={11} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => `Semana de ${label}`}
              formatter={(value) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">Enviadas</span>
                  <span className="font-medium tabular-nums">{String(value)}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
    </>
  );
}

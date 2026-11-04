"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeeklyPoint } from "../metrics";

const placeholder = <Skeleton className="h-52 w-full" />;

// O Recharts é o maior pacote do painel e o gráfico fica no fim da página:
// só baixa quando ele está perto de aparecer.
const WeeklyChart = dynamic(() => import("./weekly-chart"), { ssr: false, loading: () => placeholder });

/** Ritmo semanal: o gráfico, mais a mesma informação em tabela para leitores de tela. */
export function WeeklyPanel({ data }: { data: WeeklyPoint[] }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [nearScreen, setNearScreen] = useState(false);

  useEffect(() => {
    if (!anchor.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearScreen(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
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
      <div ref={anchor}>{nearScreen ? <WeeklyChart data={data} /> : placeholder}</div>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { NoApplications } from "@/features/applications/components/no-applications";
import { listApplicationSummaries } from "@/features/applications/queries";
import { BoardView } from "@/features/board/components/board-view";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Quadro" };

export default function BoardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Quadro"
        description={
          <>
            <span className="hidden md:inline">Arraste os cards entre as colunas para mudar a etapa.</span>
            <span className="md:hidden">Use o menu ⋯ de cada card para mudar a etapa.</span> Cada mudança entra na
            linha do tempo.
          </>
        }
        className="px-4 pt-6 pb-4 sm:px-6"
      />
      <Suspense fallback={<BoardSkeleton />}>
        <BoardContent />
      </Suspense>
    </div>
  );
}

async function BoardContent() {
  const applications = await listApplicationSummaries();
  if (applications.length === 0) {
    return (
      <div className="px-4 sm:px-6">
        <NoApplications />
      </div>
    );
  }
  return <BoardView applications={applications} today={todayISO()} />;
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-4 sm:px-6" aria-busy aria-label="Carregando o quadro">
      {Array.from({ length: 5 }, (_, column) => (
        <div key={column} className="w-64 shrink-0 space-y-2 rounded-xl bg-muted/40 p-2">
          <Skeleton className="m-1 h-5 w-32" />
          {Array.from({ length: 3 - (column % 2) }, (_, card) => (
            <Skeleton key={card} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

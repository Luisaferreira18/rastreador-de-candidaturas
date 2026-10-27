import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationsTable } from "@/features/applications/components/applications-table";
import { NoApplications } from "@/features/applications/components/no-applications";
import { listApplicationSummaries } from "@/features/applications/queries";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Lista" };

export default function ListPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="Lista"
        description="Busque, filtre e ordene todas as suas candidaturas."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export" download>
              <Download /> Exportar CSV
            </a>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <ListContent />
      </Suspense>
    </div>
  );
}

async function ListContent() {
  const applications = await listApplicationSummaries();
  if (applications.length === 0) return <NoApplications />;
  return <ApplicationsTable applications={applications} today={todayISO()} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando a lista">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="space-y-px overflow-hidden rounded-xl border">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-none" />
        ))}
      </div>
    </div>
  );
}

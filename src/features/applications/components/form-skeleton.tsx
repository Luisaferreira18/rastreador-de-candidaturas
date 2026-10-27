import { Skeleton } from "@/components/ui/skeleton";

export function FormSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2" aria-busy aria-label="Carregando o formulário">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
      <Skeleton className="h-28 w-full sm:col-span-2" />
    </div>
  );
}

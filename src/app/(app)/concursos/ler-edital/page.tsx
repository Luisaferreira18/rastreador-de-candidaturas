import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoticeReader } from "@/features/concursos/components/notice-reader";
import { requireUser } from "@/features/auth/session";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Ler edital" };

export default function ReadNoticePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/concursos">
          <ArrowLeft /> Voltar aos concursos
        </Link>
      </Button>
      <PageHeader
        title="Ler edital"
        description="Cole o texto ou o link do edital. O app sugere órgão, cargo, banca, salário, vagas e as datas do cronograma, e você confere antes de salvar."
        className="mb-8"
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <Reader />
      </Suspense>
    </div>
  );
}

async function Reader() {
  // A data de hoje depende da requisição (e do login, que a rota da leitura também exige).
  await requireUser();
  return <NoticeReader today={todayISO()} />;
}

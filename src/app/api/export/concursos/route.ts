import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { buildConcursosCsv } from "@/features/concursos/export";
import { getConcursoExportData } from "@/features/concursos/queries";
import { todayISO } from "@/lib/format";

/** GET /api/export/concursos: baixa todos os concursos do usuário logado em CSV. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para exportar." }, { status: 401 });
    }

    const csv = buildConcursosCsv(await getConcursoExportData());
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="concursos-${todayISO()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[export/concursos]", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo. Tente novamente." }, { status: 500 });
  }
}

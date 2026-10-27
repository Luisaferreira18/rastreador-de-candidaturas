import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { buildApplicationsCsv } from "@/features/applications/export";
import { getExportData } from "@/features/applications/queries";
import { todayISO } from "@/lib/format";

/** GET /api/export: baixa todas as candidaturas do usuário logado em CSV. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para exportar." }, { status: 401 });
    }

    const csv = buildApplicationsCsv(await getExportData());
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="candidaturas-${todayISO()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Deixa passar os sinais internos do Next.js (ex.: "esta rota é dinâmica").
    unstable_rethrow(error);
    console.error("[export]", error);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo. Tente novamente." }, { status: 500 });
  }
}

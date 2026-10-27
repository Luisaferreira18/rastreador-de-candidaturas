import { NextResponse, type NextRequest } from "next/server";
import { buildDailyReport } from "@/features/report/build";
import { InvalidTokenError, loadSnapshotByToken } from "@/features/report/load";
import { renderReportEmail } from "@/features/report/render";
import { todayISO } from "@/lib/format";

/**
 * POST /api/report: o script do Google chama todo dia de manhã, com o token
 * pessoal, e recebe o resumo pronto para mandar ao Gmail da própria pessoa.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Envie o token no cabeçalho Authorization." }, { status: 401 });

  try {
    const snapshot = await loadSnapshotByToken(token);
    const report = buildDailyReport(snapshot, todayISO());
    const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const email = renderReportEmail(report, appUrl);
    return NextResponse.json({ assunto: email.subject, html: email.html, texto: email.text, vazio: report.isEmpty });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: "Token inválido. Gere um novo script no app." }, { status: 401 });
    }
    console.error("[report]", error);
    return NextResponse.json({ error: "Não foi possível montar o relatório." }, { status: 500 });
  }
}

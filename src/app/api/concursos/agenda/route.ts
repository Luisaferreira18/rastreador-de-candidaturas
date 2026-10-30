import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { buildConcursoCalendar, calendarFileName } from "@/features/concursos/calendar";
import { getConcursoCalendarData } from "@/features/concursos/queries";

/**
 * GET /api/concursos/agenda: baixa o cronograma em .ics para importar no
 * Google Agenda ou no calendário do celular. Com `?id=`, só daquele concurso;
 * sem, de todos.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para baixar a agenda." }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id") ?? undefined;
    const items = await getConcursoCalendarData(id);
    if (!items) return NextResponse.json({ error: "Concurso não encontrado." }, { status: 404 });

    const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const single = id ? items[0].concurso : undefined;
    const ics = buildConcursoCalendar(items, {
      appUrl,
      name: single ? `${single.organ} · ${single.role_title}` : "Concursos",
    });
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${calendarFileName(single)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[concursos/agenda]", error);
    return NextResponse.json({ error: "Não foi possível gerar a agenda. Tente novamente." }, { status: 500 });
  }
}

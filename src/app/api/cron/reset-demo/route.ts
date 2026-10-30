import { NextResponse, type NextRequest } from "next/server";
import { resetDemoAccount } from "@/features/demo/seed";
import { getDemoCredentials } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/reset-demo: chamado pelo Cron da Vercel uma vez por dia
 * (veja vercel.json). Recria a conta de demonstração com os dados de exemplo.
 *
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>" automaticamente quando
 * a variável CRON_SECRET está configurada; sem ela, a rota fica bloqueada.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const credentials = getDemoCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "DEMO_EMAIL e DEMO_PASSWORD não configurados." }, { status: 500 });
  }

  try {
    const result = await resetDemoAccount(createAdminClient(), credentials.email, credentials.password);
    return NextResponse.json({
      ok: true,
      applications: result.applications,
      tasks: result.tasks,
      concursos: result.concursos,
      concursoLeads: result.concursoLeads,
    });
  } catch (error) {
    console.error("[cron/reset-demo]", error);
    return NextResponse.json({ error: "Falha ao restaurar a conta demo." }, { status: 500 });
  }
}

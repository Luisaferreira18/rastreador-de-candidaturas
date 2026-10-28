import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { extractResume, hasReadableText } from "@/features/resume/extract";
import { PdfError, isPdf, readPdfText } from "@/features/resume/pdf";
import {
  DEMO_RESUME_MESSAGE,
  MAX_RESUME_BYTES,
  RESUME_BUCKET,
  resumePath,
  toResumeRow,
  type ResumeUploadResponse,
} from "@/features/resume/resume";
import { friendlyDbError } from "@/lib/action-result";
import { todayISO } from "@/lib/format";
import { revalidateApp } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

/** Ler um PDF grande leva alguns segundos. */
export const maxDuration = 30;

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente para continuar.";

const fail = (message: string, status: number) =>
  NextResponse.json({ status: "erro", message } satisfies ResumeUploadResponse, { status });

/**
 * POST /api/curriculo: recebe o PDF (campo "arquivo"), lê o texto, guarda o
 * arquivo no bucket privado e o que foi lido na tabela `resumes`. A sessão é
 * a da própria pessoa, então as regras de acesso do banco valem também aqui.
 *
 * É uma rota, e não uma Server Action, porque as Server Actions aceitam no
 * máximo 1 MB por envio.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(SESSION_EXPIRED, 401);
  if (user.isDemo) return fail(DEMO_RESUME_MESSAGE, 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("arquivo");
  if (!(file instanceof File)) return fail("Escolha o arquivo do currículo, em PDF.", 400);
  if (file.size === 0) return fail("Esse arquivo está vazio.", 400);
  if (file.size > MAX_RESUME_BYTES) return fail("O arquivo passa de 4 MB. Exporte o PDF de novo, sem fotos em alta resolução.", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return fail("Esse arquivo não é um PDF. Salve o currículo como PDF e envie de novo.", 415);

  let text: string;
  try {
    text = await readPdfText(bytes);
  } catch (error) {
    if (error instanceof PdfError) return fail(error.message, 422);
    console.error("[curriculo] leitura do PDF", error);
    return fail("Não foi possível ler esse PDF. Exporte de novo pelo Word ou pelo Google Docs.", 422);
  }
  if (!hasReadableText(text)) {
    return fail(
      "Não encontramos texto nesse PDF: ele parece ser uma imagem (currículo escaneado ou foto). Exporte de novo pelo Word ou pelo Google Docs.",
      422,
    );
  }

  const extraction = extractResume(text, Number(todayISO().slice(0, 4)));

  try {
    const supabase = await createClient();
    const upload = await supabase.storage
      .from(RESUME_BUCKET)
      .upload(resumePath(user.id), bytes, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw upload.error;

    const { data, error } = await supabase
      .from("resumes")
      .upsert(toResumeRow(user.id, file, extraction), { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;

    // Libera a próxima busca, que já usa as habilidades do currículo novo.
    const profile = await supabase.from("job_profiles").update({ last_run_at: null }).eq("user_id", user.id);
    if (profile.error) throw profile.error;

    revalidateApp();
    return NextResponse.json({ status: "ok", resume: data } satisfies ResumeUploadResponse);
  } catch (error) {
    unstable_rethrow(error);
    return fail(friendlyDbError(error, "Não foi possível guardar o currículo. Tente de novo em instantes."), 500);
  }
}

/** GET /api/curriculo: abre o PDF por um link temporário (1 minuto). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(RESUME_BUCKET).createSignedUrl(resumePath(user.id), 60);
  if (error || !data?.signedUrl) {
    return new NextResponse("Currículo não encontrado.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.redirect(data.signedUrl);
}

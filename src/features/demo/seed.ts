import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractResume } from "@/features/resume/extract";
import { readPdfText } from "@/features/resume/pdf";
import { RESUME_BUCKET, resumePath, toResumeRow } from "@/features/resume/resume";
import { todayISO } from "@/lib/format";
import type { Database } from "@/types/database";
import { buildSampleData } from "./sample-data";

/** Currículo fictício da conta demo (também usado nos testes). */
export const DEMO_RESUME_FILE = join(process.cwd(), "assets/demo/curriculo-demo.pdf");

type Client = SupabaseClient<Database>;

/**
 * Grava os dados de exemplo para um usuário. Funciona tanto com o cliente do
 * próprio usuário (RLS ativo) quanto com o cliente administrativo.
 */
export async function seedSampleData(supabase: Client, userId: string, today: string = todayISO()) {
  const plan = buildSampleData(userId, today, () => crypto.randomUUID());
  const ids = plan.applications.map((application) => application.id);

  const applications = await supabase.from("applications").insert(plan.applications);
  if (applications.error) throw applications.error;

  // O trigger já registrou a etapa atual de cada candidatura; trocamos esse
  // registro pela linha do tempo completa, com as datas do passado.
  const cleanup = await supabase.from("stage_history").delete().in("application_id", ids);
  if (cleanup.error) throw cleanup.error;

  const history = await supabase.from("stage_history").insert(plan.history);
  if (history.error) throw history.error;

  if (plan.tasks.length > 0) {
    const tasks = await supabase.from("tasks").insert(plan.tasks);
    if (tasks.error) throw tasks.error;
  }

  // defaultToNull: colunas ausentes em algumas linhas usam o valor padrão do banco.
  const inbox = await supabase.from("inbox_items").insert(plan.inbox, { defaultToNull: false });
  if (inbox.error) throw inbox.error;

  return { applications: plan.applications.length, tasks: plan.tasks.length };
}

/**
 * Apaga as candidaturas do usuário (histórico e tarefas vão junto, em cascata),
 * a caixa de entrada, as vagas sugeridas e o perfil de busca.
 */
export async function clearUserData(supabase: Client, userId: string) {
  const inbox = await supabase.from("inbox_items").delete().eq("user_id", userId);
  if (inbox.error) throw inbox.error;
  const leads = await supabase.from("job_leads").delete().eq("user_id", userId);
  if (leads.error) throw leads.error;
  const profile = await supabase.from("job_profiles").delete().eq("user_id", userId);
  if (profile.error) throw profile.error;
  const { error } = await supabase.from("applications").delete().eq("user_id", userId);
  if (error) throw error;
}

/**
 * Marca a conta como protegida no banco e guarda a senha oficial (no Vault).
 * Um gatilho em auth.users recusa trocar o e-mail e aceita trocar a senha só
 * para essa senha oficial: nem chamando o Supabase direto pelo navegador um
 * visitante consegue tomar a conta demo.
 */
export async function protectDemoAccount(admin: Client, userId: string, password: string) {
  const { error } = await admin.rpc("protect_demo_account", { p_user_id: userId, p_password: password });
  if (error) throw error;
}

/**
 * Garante que a conta de demonstração existe, com e-mail confirmado e a senha
 * do .env, e que está protegida. Requer o cliente admin.
 */
export async function ensureDemoUser(admin: Client, email: string, password: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Conta de demonstração" },
  });
  if (created.data.user) {
    await protectDemoAccount(admin, created.data.user.id, password);
    return created.data.user.id;
  }

  const alreadyExists =
    created.error?.code === "email_exists" ||
    created.error?.code === "user_already_exists" ||
    created.error?.status === 422;
  if (!alreadyExists) throw created.error;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      // Primeiro a senha oficial no banco: só ela passa pela proteção da conta.
      await protectDemoAccount(admin, user.id, password);
      const updated = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (updated.error) throw updated.error;
      return user.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`Não foi possível encontrar a conta demo (${email}).`);
}

/**
 * Perfil de busca da conta demo. As vagas em si vêm da busca real, que roda
 * quando alguém abre a demonstração (ou no cron diário).
 */
export async function seedDemoJobProfile(supabase: Client, userId: string) {
  const { error } = await supabase.from("job_profiles").upsert(
    {
      user_id: userId,
      roles: ["Estágio em Dados", "Estágio em Desenvolvimento"],
      job_types: ["estagio", "trainee"],
      work_models: ["presencial", "hibrido", "remoto"],
      city: "São Paulo",
      state: "SP",
      keywords: ["SQL", "Python", "Excel", "Power BI", "JavaScript", "inglês"],
      excluded_words: [],
      auto_search: true,
      last_run_at: null,
      last_run_stats: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/**
 * Currículo fictício da conta demo, lido do PDF como um currículo enviado.
 * Só o cliente admin consegue gravar: a conta é protegida e os visitantes não
 * podem enviar nem apagar currículo nela.
 */
export async function seedDemoResume(admin: Client, userId: string) {
  const bytes = new Uint8Array(await readFile(DEMO_RESUME_FILE));
  const upload = await admin.storage
    .from(RESUME_BUCKET)
    .upload(resumePath(userId), bytes, { contentType: "application/pdf", upsert: true });
  if (upload.error) throw upload.error;

  const extraction = extractResume(await readPdfText(bytes), Number(todayISO().slice(0, 4)));
  const row = toResumeRow(userId, { name: "curriculo-demo.pdf", size: bytes.length }, extraction);
  const { error } = await admin.from("resumes").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

/** Recria a conta demo do zero: usado pelo cron diário e por `npm run seed:demo`. */
export async function resetDemoAccount(admin: Client, email: string, password: string) {
  const userId = await ensureDemoUser(admin, email, password);
  await clearUserData(admin, userId);
  const result = await seedSampleData(admin, userId);
  await seedDemoJobProfile(admin, userId);
  await seedDemoResume(admin, userId);
  return { userId, ...result };
}

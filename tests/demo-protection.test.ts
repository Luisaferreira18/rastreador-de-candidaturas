import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { describe, expect, it, vi } from "vitest";
import { ensureDemoUser, resetDemoAccount } from "@/features/demo/seed";
import { createFakeSupabase } from "./support/fake-supabase";

const EMAIL = "demo@rastreador.app";
const PASSWORD = "senha-oficial-da-demo";

/**
 * Cliente administrativo de mentira: registra a ordem das chamadas ao Auth e
 * à função protect_demo_account, além das tabelas (via createFakeSupabase).
 */
function fakeAdmin({ exists = true, protectError = null as unknown } = {}) {
  const order: string[] = [];
  const db = createFakeSupabase();
  const rpc = vi.fn(async (name: string) => {
    order.push(`rpc:${name}`);
    return { data: null, error: protectError };
  });
  const auth = {
    admin: {
      createUser: vi.fn(async () => {
        order.push("createUser");
        return exists
          ? { data: { user: null }, error: { code: "email_exists", status: 422 } }
          : { data: { user: { id: "demo-id" } }, error: null };
      }),
      listUsers: vi.fn(async () => ({ data: { users: [{ id: "demo-id", email: EMAIL }] }, error: null })),
      updateUserById: vi.fn(async () => {
        order.push("updateUserById");
        return { data: { user: { id: "demo-id" } }, error: null };
      }),
    },
  };
  const from = (table: string) => {
    order.push(`from:${table}`);
    return db.client.from(table);
  };
  return { admin: { from, rpc, auth } as never, rpc, auth, order, calls: db.calls };
}

describe("reset da conta demo com a proteção do banco", () => {
  it("registra a senha oficial antes de redefinir a senha (senão o gatilho recusaria)", async () => {
    const { admin, rpc, order } = fakeAdmin();
    await expect(ensureDemoUser(admin, EMAIL, PASSWORD)).resolves.toBe("demo-id");
    expect(rpc).toHaveBeenCalledWith("protect_demo_account", { p_user_id: "demo-id", p_password: PASSWORD });
    expect(order.indexOf("rpc:protect_demo_account")).toBeLessThan(order.indexOf("updateUserById"));
  });

  it("conta criada agora também já nasce protegida", async () => {
    const { admin, order } = fakeAdmin({ exists: false });
    await ensureDemoUser(admin, EMAIL, PASSWORD);
    expect(order).toEqual(["createUser", "rpc:protect_demo_account"]);
  });

  it("se a proteção falhar, não tenta trocar a senha e o reset avisa o erro", async () => {
    const { admin, auth } = fakeAdmin({ protectError: { code: "42501", message: "permission denied" } });
    await expect(ensureDemoUser(admin, EMAIL, PASSWORD)).rejects.toMatchObject({ code: "42501" });
    expect(auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("GET /api/cron/reset-demo continua restaurando a conta, na ordem certa", async () => {
    const fake = fakeAdmin();
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.admin }));
    process.env.CRON_SECRET = "segredo-do-cron";
    process.env.DEMO_EMAIL = EMAIL;
    process.env.DEMO_PASSWORD = PASSWORD;
    const { GET } = await import("@/app/api/cron/reset-demo/route");
    const { NextRequest } = await import("next/server");

    const denied = await GET(new NextRequest("http://localhost/api/cron/reset-demo"));
    expect(denied.status).toBe(401);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/reset-demo", { headers: { authorization: "Bearer segredo-do-cron" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });

    // Protege, redefine a senha e só depois apaga e recria os dados de exemplo.
    const protect = fake.order.indexOf("rpc:protect_demo_account");
    const update = fake.order.indexOf("updateUserById");
    const firstWrite = fake.order.findIndex((step) => step.startsWith("from:"));
    expect(protect).toBeGreaterThanOrEqual(0);
    expect(protect).toBeLessThan(update);
    expect(update).toBeLessThan(firstWrite);
    expect(fake.calls.some((call) => call.table === "applications" && call.operation === "insert")).toBe(true);
    expect(fake.calls.some((call) => call.table === "job_profiles" && call.operation === "upsert")).toBe(true);
    vi.doUnmock("@/lib/supabase/admin");
  });

  it("resetDemoAccount devolve o que foi recriado", async () => {
    const { admin } = fakeAdmin();
    const result = await resetDemoAccount(admin, EMAIL, PASSWORD);
    expect(result.userId).toBe("demo-id");
    expect(result.applications).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Contra o Supabase de verdade (opcional): SUPABASE_INTEGRATION=1 npm test
// Faz login na demo com a chave pública, como um visitante faria no navegador.
// ---------------------------------------------------------------------------
config({ path: ".env.local", quiet: true });
// Copiados agora: o teste da rota acima troca DEMO_EMAIL e DEMO_PASSWORD no ambiente.
const real = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  email: process.env.DEMO_EMAIL ?? "",
  password: process.env.DEMO_PASSWORD ?? "",
};
const integration = process.env.SUPABASE_INTEGRATION === "1" && Boolean(real.email && real.password);

describe.skipIf(!integration)("conta demo no Supabase de verdade", () => {
  const publicClient = () =>
    createClient(real.url, real.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  it("um visitante logado na demo não troca a senha nem o e-mail pelo navegador", { timeout: 30_000 }, async () => {
    const browser = publicClient();
    const login = await browser.auth.signInWithPassword({ email: real.email, password: real.password });
    expect(login.error).toBeNull();

    // Recusada pelo gatilho do banco ("Error during password storage").
    const password = await browser.auth.updateUser({ password: "senha-do-invasor-123" });
    expect(password.error).not.toBeNull();
    // Hoje o Supabase já recusa antes, porque o domínio da demo não recebe e-mail;
    // se a demo usar um domínio que receba, quem recusa é o gatilho.
    const email = await browser.auth.updateUser({ email: "invasor@example.com" });
    expect(email.error).not.toBeNull();
    await browser.auth.signOut();

    // A senha oficial continua valendo; a do invasor, não.
    const official = await publicClient().auth.signInWithPassword({ email: real.email, password: real.password });
    expect(official.error).toBeNull();
    expect(official.data.user?.email).toBe(real.email);
    const attacker = await publicClient().auth.signInWithPassword({ email: real.email, password: "senha-do-invasor-123" });
    expect(attacker.error).not.toBeNull();
  });

  it.skipIf(!real.secretKey)(
    "o reset do cron (chave secreta) continua redefinindo a senha oficial",
    { timeout: 30_000 },
    async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      await ensureDemoUser(createAdminClient(), real.email, real.password);
      const login = await publicClient().auth.signInWithPassword({ email: real.email, password: real.password });
      expect(login.error).toBeNull();
    },
  );
});

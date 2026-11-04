import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }));

const visit = (path: string) => updateSession(new NextRequest(`http://localhost${path}`));
const location = (response: Response) => response.headers.get("location");

describe("página inicial pública", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
    getClaims.mockReset();
  });

  it("quem não entrou vê a página inicial, sem redirecionamento", async () => {
    getClaims.mockResolvedValue({ data: null });
    const response = await visit("/");
    expect(location(response)).toBeNull();
    expect(response.status).toBe(200);
  });

  it("quem já entrou continua indo para o painel", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    expect(location(await visit("/"))).toBe("http://localhost/painel");
  });

  it("o resto do app segue pedindo login", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect(location(await visit("/painel"))).toBe("http://localhost/login?next=%2Fpainel");
  });
});

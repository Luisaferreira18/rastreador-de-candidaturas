import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/database";

/** Páginas que não exigem login. */
const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/auth",
  "/api/cron",
  "/api/inbox",
  "/api/report",
  "/api/whatsapp",
  "/manifest.webmanifest",
  // Imagem de compartilhamento: WhatsApp, LinkedIn etc. buscam sem login.
  "/opengraph-image",
];
/** Páginas que um usuário logado não precisa ver. */
const GUEST_ONLY_PATHS = ["/login", "/cadastro", "/recuperar-senha"];

function matches(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Renova a sessão do Supabase a cada requisição e redireciona conforme o login.
 * Chamado pelo `src/proxy.ts`.
 */
export async function updateSession(request: NextRequest) {
  // Sem as chaves configuradas, deixa passar: as páginas mostram a mensagem de configuração.
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e o getClaims():
  // é ele que valida o token e, se preciso, renova a sessão.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const redirect = NextResponse.redirect(url);
    // Leva junto os cookies renovados, senão o usuário pode ser deslogado.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (pathname === "/") {
    return redirectTo(isLoggedIn ? "/painel" : "/login");
  }

  if (!isLoggedIn && !matches(pathname, PUBLIC_PATHS)) {
    return redirectTo("/login", { next: `${pathname}${search}` });
  }

  if (isLoggedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo("/painel");
  }

  return response;
}

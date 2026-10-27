import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { MissingEnvError } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente com a chave secreta: ignora o RLS. Use apenas no servidor
 * (cron da conta demo e script de seed). Nunca importe em Client Components.
 *
 * Não usa `import "server-only"` porque também roda no script `npm run seed:demo`.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("O cliente administrativo do Supabase só pode ser usado no servidor.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !secretKey && "SUPABASE_SECRET_KEY",
  ].filter(Boolean) as string[];
  if (missing.length > 0) throw new MissingEnvError(missing);

  return createSupabaseClient<Database>(url!, secretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

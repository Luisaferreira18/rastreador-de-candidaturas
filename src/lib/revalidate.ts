import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Depois de qualquer alteração, invalida todas as páginas do app
 * (painel, quadro, lista e detalhe usam os mesmos dados).
 */
export function revalidateApp() {
  revalidatePath("/", "layout");
}

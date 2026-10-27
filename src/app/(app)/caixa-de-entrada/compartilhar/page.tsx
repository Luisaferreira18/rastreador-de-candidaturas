import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedMessage } from "@/features/inbox/components/shared-message";

export const metadata: Metadata = { title: "Analisando mensagem" };

/**
 * Destino do botão "Compartilhar" do Android (o app instalado aparece na lista
 * ao compartilhar uma mensagem do WhatsApp). Veja src/app/manifest.ts.
 */
export default function SharePage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Analisando a mensagem…</p>}>
        <SharedMessage />
      </Suspense>
    </div>
  );
}

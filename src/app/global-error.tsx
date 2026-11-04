"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/sentry";

/** Última rede de proteção: erro no layout raiz. Fica fora do tema e dos estilos do app. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Não foi possível abrir o app</h1>
        <p>Pode ter sido uma falha de conexão. Seus dados estão seguros.</p>
        <button type="button" onClick={() => retry()} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}

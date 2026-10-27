import type { MetadataRoute } from "next";

/**
 * Permite instalar o app no celular. No Android, o app instalado aparece no
 * menu "Compartilhar": uma mensagem do WhatsApp compartilhada com ele vira
 * uma sugestão na caixa de entrada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rastreador de candidaturas",
    short_name: "Rastreador",
    description: "Acompanhe suas candidaturas a vagas: quadro Kanban, prazos e métricas.",
    lang: "pt-BR",
    start_url: "/painel",
    display: "standalone",
    background_color: "#fcfcfd",
    theme_color: "#5550d8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/caixa-de-entrada/compartilhar",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}

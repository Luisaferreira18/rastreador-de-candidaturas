import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // O navegador recebe o DSN do Sentry no build. Só existe uma variável para configurar.
  env: { NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "" },
  // O cron da conta demo lê o currículo fictício do disco.
  outputFileTracingIncludes: {
    "/api/cron/reset-demo": ["./assets/demo/curriculo-demo.pdf"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

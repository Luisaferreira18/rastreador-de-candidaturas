import { sentryOptions } from "@/lib/sentry";

// Sem SENTRY_DSN no build, o SDK nem entra no código do navegador.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions(dsn)));
}

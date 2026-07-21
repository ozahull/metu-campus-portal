// Sentry — EDGE runtime (proxy/middleware, edge route'ları) hata izleme.
// instrumentation.ts register() içinde NEXT_RUNTIME==='edge' iken import edilir.
// Aynı gizlilik (KVKK) kuralları: PII scrub + yalnız kullanıcı id (bkz.
// sentry.server.config.ts).
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumbScrub, beforeSendScrub } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.SENTRY_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: beforeSendScrub,
  beforeBreadcrumb: beforeBreadcrumbScrub,
  debug: false,
});

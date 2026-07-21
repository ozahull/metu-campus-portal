// Sentry — EDGE runtime (proxy/middleware, edge route'ları) hata izleme.
// instrumentation.ts register() içinde NEXT_RUNTIME==='edge' iken import edilir.
// Aynı gizlilik (KVKK) kuralları: PII scrub + yalnız kullanıcı id (bkz.
// sentry.server.config.ts).
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumbScrub, beforeSendScrub } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// TANI (sessiz no-op'a karşı): edge runtime DSN'i runtime'da okunur; env değişimi
// için YENİDEN DEPLOY gerekir (bkz. sentry.server.config.ts). DSN yoksa görünür uyarı.
if (!dsn && process.env.NODE_ENV === "production") {
  console.warn(
    "[Sentry] SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN yok (edge) — hata izleme DEVRE DIŞI. " +
      "Vercel ortamına DSN ekleyip YENİDEN DEPLOY edin.",
  );
}

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

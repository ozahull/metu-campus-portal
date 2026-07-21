// Sentry — TARAYICI (client) hata izleme. Next 16 `instrumentation-client.ts`
// (v15.3+) React hydration'dan ÖNCE çalışır → erken hataları da yakalar.
//
// GİZLİLİK (KVKK): sendDefaultPii=false + beforeSend/beforeBreadcrumb PII scrub
// (e-posta/ad/mesaj/token/çerez). Session Replay KAPALI (DOM yakalamaz). DSN yoksa
// SDK devre dışı. onRouterTransitionStart → Sentry navigasyon izlemesi.
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumbScrub, beforeSendScrub } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  // HATALAR %100, performans izleme %10.
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: beforeSendScrub,
  beforeBreadcrumb: beforeBreadcrumbScrub,
  debug: false,
});

// Client-side router geçişlerini Sentry'ye bildir (navigasyon performansı/izi).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

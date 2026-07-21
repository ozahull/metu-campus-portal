// Sentry — TARAYICI (client) hata izleme. Next 16 `instrumentation-client.ts`
// (v15.3+) React hydration'dan ÖNCE çalışır → erken hataları da yakalar.
//
// GİZLİLİK (KVKK): sendDefaultPii=false + beforeSend/beforeBreadcrumb PII scrub
// (e-posta/ad/mesaj/token/çerez). Session Replay KAPALI (DOM yakalamaz). DSN yoksa
// SDK devre dışı. onRouterTransitionStart → Sentry navigasyon izlemesi.
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumbScrub, beforeSendScrub } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// TANI (sessiz no-op'a karşı): NEXT_PUBLIC_* değişkenleri BUILD zamanında client
// bundle'a GÖMÜLÜR. DSN build anında yoksa `enabled:false` olur ve SDK hiçbir
// istek göndermez — canlıda bu "0 istek / waiting for first event" olarak görünür,
// nedeni belirsizdir. Production bundle'ında görünür uyarı bırak: Vercel Production
// ortamına DSN eklendikten sonra YENİDEN DEPLOY şarttır (mevcut build gömülü değeri taşır).
if (!dsn && process.env.NODE_ENV === "production") {
  console.warn(
    "[Sentry] NEXT_PUBLIC_SENTRY_DSN bu build'e gömülü DEĞİL — tarayıcı hata izleme DEVRE DIŞI. " +
      "Vercel Production ortamına DSN ekleyip YENİDEN DEPLOY edin.",
  );
}

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

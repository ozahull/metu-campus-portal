// Sentry — SUNUCU (Node.js runtime) hata izleme.
// instrumentation.ts register() içinde NEXT_RUNTIME==='nodejs' iken import edilir.
//
// GİZLİLİK (KVKK): sendDefaultPii=false + beforeSend/beforeBreadcrumb ile PII
// (e-posta, ad, bio, mesaj içeriği, bilet token'ı, çerez) temizlenir. Kullanıcı
// yalnızca id ile tanımlanır. DSN yoksa SDK devre dışı (enabled=false) — geliştirme
// ortamında sessizce no-op.
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumbScrub, beforeSendScrub } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Ortam ayrımı: Vercel VERCEL_ENV (production/preview/development) → aksi halde NODE_ENV.
  environment:
    process.env.SENTRY_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  // Örnekleme: HATALAR %100, performans izleme %10 (ücretsiz kotayı korumak için).
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  // PII: asla varsayılan olarak IP/çerez/başlık/kullanıcı e-postası gönderme.
  sendDefaultPii: false,
  beforeSend: beforeSendScrub,
  beforeBreadcrumb: beforeBreadcrumbScrub,
  debug: false,
});

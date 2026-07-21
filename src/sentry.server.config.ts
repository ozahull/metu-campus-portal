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

// TANI (sessiz no-op'a karşı): sunucu DSN'i RUNTIME'da okunur. Vercel env'i
// deploy anında fonksiyona enjekte edilir → panelden env eklendikten sonra
// YENİDEN DEPLOY edilmeden mevcut deployment DSN'i GÖRMEZ. DSN yoksa SDK sessizce
// devre dışı kalır. Production'da görünür uyarı bırak (Vercel fonksiyon loglarına düşer).
if (!dsn && process.env.NODE_ENV === "production") {
  console.warn(
    "[Sentry] SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN runtime'da yok — sunucu hata izleme DEVRE DIŞI. " +
      "Vercel ortamına DSN ekleyip YENİDEN DEPLOY edin.",
  );
}

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

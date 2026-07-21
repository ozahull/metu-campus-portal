import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Sentry ingest host'u — CSP connect-src'ye eklenir (aşağıda). DSN'in bölgesi
// (o<org>.ingest.sentry.io / .us. / .de.) baştan bilinmediği için wildcard.
// Eklenmezse ENFORCE CSP tarayıcıda Sentry isteklerini SESSİZCE bloklar.
const SENTRY_INGEST = "https://*.sentry.io";

// Supabase host'u CSP connect/img kaynakları için (env varsa oradan; yoksa
// bilinen proje ref'i). Realtime websocket için wss karşılığı da gerekir.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zmnmdcuvdrvgdkdcaxjj.supabase.co";
const SUPABASE_WSS = SUPABASE_URL.replace(/^https:/, "wss:");

// GÜVENLİK SERTLEŞTİRME #3 — CSP artık ENFORCE modunda (Content-Security-Policy).
// Report-Only turunda canlıda 13 sayfa gezildi ve ihlal envanteri BOŞ çıktı
// (tespit mekanizması kasıtlı harici görselle doğrulandı) → politika bloklamaya
// alındı. Direktif STRING'i Report-Only ile BİREBİR aynıdır; yalnız başlık adı
// değişti (yeni blok riski yok).
//
// 'unsafe-inline' KORUNDU (KALDIRMA): Next.js App Router hydration bootstrap'i
// inline <script> üretir; nonce tabanlı CSP, nonce'un proxy'de üretilip her isteğe
// işlenmesini gerektirir (statik headers() ile mümkün değil — ayrı refactor).
// Şimdi kaldırılırsa site kırılır. style-src 'unsafe-inline': next/font + inline
// stiller. worker-src blob: html5-qrcode tarayıcı worker'ı için.
//
// ⚠️ DEPLOY SONRASI: izin listesinde OLMAYAN yeni bir kaynak artık BLOKLANIR —
// canlıda tam bir tur (tüm sayfalar + QR check-in + push) gerekiyor.
const CSP = [
  "default-src 'self'",
  `connect-src 'self' ${SUPABASE_URL} ${SUPABASE_WSS} https://fcm.googleapis.com https://vercel.live ${SENTRY_INGEST}`,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_URL}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  // Clickjacking: /login iframe'e alınamaz (CSP frame-ancestors ile çift katman).
  { key: "X-Frame-Options", value: "DENY" },
  // ?code= / ?next= içeren URL'ler cross-origin'e yalnız origin sızdırır.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // MIME sniffing kapalı.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Kamera yalnız kendi origin'imiz (QR check-in tarayıcısı); mikrofon/konum kapalı.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  // HSTS — Vercel genelde ekler; yine de açıkça bildirilir (zararsız, idempotent).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // CSP — ENFORCE modunda (yukarıdaki blok yorumuna bak; 'unsafe-inline' korunur).
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  // Üst dizinde başka bir lockfile bulunduğu için Turbopack'in workspace
  // kökünü bu projeye sabitliyoruz.
  turbopack: {
    root: __dirname,
  },
  // next/image için Supabase Storage (public bucket'lar: club-images) izinli host.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zmnmdcuvdrvgdkdcaxjj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Sentry: config'i sarmalar (instrumentation + onRequestError + kaynak haritası
// yükleme). Kaynak haritaları YALNIZCA SENTRY_AUTH_TOKEN varsa yüklenir; yoksa
// build sessizce atlar (kırılmaz). Yüklenen .map'ler client bundle'dan silinir
// (herkese açık kaynak sızıntısı yok). disableLogger/automaticVercelMonitors
// Turbopack ile çalışmadığından KULLANILMADI (deprecation uyarısı çıkmasın).
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  telemetry: false,
});

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Supabase host'u CSP connect/img kaynakları için (env varsa oradan; yoksa
// bilinen proje ref'i). Realtime websocket için wss karşılığı da gerekir.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zmnmdcuvdrvgdkdcaxjj.supabase.co";
const SUPABASE_WSS = SUPABASE_URL.replace(/^https:/, "wss:");

// GÜVENLİK SERTLEŞTİRME #3 — CSP şimdilik RAPOR modunda
// (Content-Security-Policy-Report-Only): hiçbir şey BLOKLANMAZ, ihlaller
// tarayıcı konsoluna düşer. Canlıda temiz çıktıktan sonra enforce'a alınacak
// (başlık adını Content-Security-Policy yapmak yeterli).
//
// 'unsafe-inline' GEREKÇESİ: Next.js App Router hydration bootstrap'i inline
// <script> üretir ve nonce tabanlı CSP, nonce'un proxy'de üretilip her isteğe
// işlenmesini gerektirir (statik headers() ile mümkün değil; ayrı bir refactor).
// Bu turda amaç önce GÖZLEM (Report-Only) — nonce'a geçiş enforce aşamasında
// değerlendirilecek. style-src 'unsafe-inline': next/font + inline stiller.
// worker-src blob: html5-qrcode tarayıcı worker'ı için.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  `connect-src 'self' ${SUPABASE_URL} ${SUPABASE_WSS} https://fcm.googleapis.com https://vercel.live`,
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
  // CSP — RAPOR modunda (yukarıdaki blok yorumuna bak; enforce ETME).
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
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

export default withNextIntl(nextConfig);

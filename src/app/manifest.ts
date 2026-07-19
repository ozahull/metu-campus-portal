import type { MetadataRoute } from "next";

// PWA manifesti (Aşama 5A). Next 16 konvansiyonu: app/manifest.ts →
// /manifest.webmanifest otomatik üretilir ve <link rel="manifest"> head'e
// enjekte edilir (elle etiket gerekmez). iOS 16.4+ web push YALNIZCA
// "Ana Ekrana Ekle" ile kurulu PWA'da çalıştığı için bu dosya Aşama 5
// push'unun ön koşuludur.
//
// RENK İSTİSNASI: manifest tarayıcıya statik JSON olarak servis edilir; CSS
// token'ları burada çözülemez. Token-only kuralının meşru istisnası olarak
// SABİT hex kullanılır — değerler globals.css :root token'larının sRGB
// karşılıkları: --background oklch(0.951 0.013 82) ≈ #f3eee5 (Dil A sıcak
// kum), --primary oklch(0.48 0.15 27) ≈ #a1302b (src/app/icon.svg ile aynı
// marka kırmızısı).
// METİN İSTİSNASI: name/short_name/description de i18n DIŞI kalır — manifest
// statik üretilir, istek bağlamı (NEXT_LOCALE cookie) burada okunamaz; kurulum
// diyaloğundaki bu metinler marka kimliğidir ("Topluluk ve Etkinlik Portalı"
// sloganıyla birlikte t() kapsamı dışında bilinçli istisna).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ODTÜ KKK Kampüs Portalı",
    short_name: "Kampüs",
    description:
      "ODTÜ Kuzey Kıbrıs Kampüsü topluluk ve etkinlik portalı — kulüpler, etkinlikler, bildirimler.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3eee5",
    theme_color: "#a1302b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

// GEÇİCİ — Sentry kurulumunu DOĞRULAMAK için kasıtlı SUNUCU hatası fırlatan yol.
// GET /api/sentry-test → 500 + Sentry'ye "server" ortamında bir hata düşer
// (instrumentation.ts onRequestError zinciri üzerinden). Doğruladıktan sonra
// bu dosyayı ve /sentry-test sayfasını SİL.
//
// Not: /api/* proxy oturum kapısının arkasında (oturumsuz → /login'e yönlenir),
// yani bu yol herkese açık değildir; yalnız giriş yapmış kullanıcı tetikleyebilir.

export const dynamic = "force-dynamic";

export function GET() {
  throw new Error(
    "Sentry doğrulama — kasıtlı SUNUCU hatası (/api/sentry-test). Bu görünüyorsa sunucu izleme çalışıyor.",
  );
}

// GEÇİCİ — Sentry kurulumunu DOĞRULAMAK için kasıtlı SUNUCU hatası fırlatan yol.
// GET /api/sentry-test → 500 + Sentry'ye "server" ortamında bir hata düşer
// (instrumentation.ts onRequestError zinciri üzerinden). Doğruladıktan sonra
// bu dosyayı ve /sentry-test sayfasını SİL.
//
// Not: /api/* proxy oturum kapısının arkasında (oturumsuz → /login'e yönlenir),
// yani bu yol herkese açık değildir; yalnız giriş yapmış kullanıcı tetikleyebilir.

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  // TANI PROBU: /api/sentry-test?check=1 → hata FIRLATMADAN, sunucunun runtime'da
  // bir DSN GÖRÜP görmediğini döndürür (DSN DEĞERİNİ değil, yalnız var/yok).
  // Env ekleyip redeploy sonrası "server DSN geldi mi" bunu tek istekle doğrular.
  const url = new URL(request.url);
  if (url.searchParams.get("check") === "1") {
    const serverDsnConfigured = Boolean(
      process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    );
    return Response.json({
      serverDsnConfigured,
      hint: serverDsnConfigured
        ? "Sunucu DSN mevcut. Hatayı test için ?check parametresini kaldırıp tekrar isteyin."
        : "Sunucu DSN YOK — Vercel ortamına DSN ekleyip YENİDEN DEPLOY edin.",
    });
  }

  throw new Error(
    "Sentry doğrulama — kasıtlı SUNUCU hatası (/api/sentry-test). Bu görünüyorsa sunucu izleme çalışıyor.",
  );
}

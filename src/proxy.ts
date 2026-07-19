import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Her istekte Supabase oturumunu (session) yeniler ve auth cookie'lerini
 * hem isteğe hem de yanıta senkronize eder. Server Component'ler bu sayede
 * geçerli bir oturuma erişebilir.
 *
 * GÜVENLİK SERTLEŞTİRME #2 — merkezî oturum kapısı: public allowlist DIŞINDA
 * kalan her yolda oturum yoksa /login'e yönlendirilir. Sayfa içi
 * getUser()+redirect kontrolleri İKİNCİ KATMAN olarak DURUR (kaldırma) —
 * bu kapı, yeni eklenen bir sayfada kontrol unutulursa SSR/yapı sızıntısını
 * önleyen emniyet ağıdır.
 */

// Oturumsuz erişilebilen yollar. /login'de oturumluya yönlendirme YOK (form
// görünür) — bu kapıyla döngü oluşmaz. /auth/* public: callback code'u oturuma
// çevirir, reset-password oturumsuz açılınca kendi "geçersiz link" ekranını
// gösterir (çıkış yollu). Statik varlıkların çoğu matcher'da zaten hariç;
// uzantıyla hariç OLMAYAN public dosyalar (sw.js, manifest) burada sayılır.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/sw.js",
  "/manifest.webmanifest",
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ÖNEMLİ: createServerClient ile getUser() arasına kod eklemeyin.
  // Aksi halde oturumun rastgele kapanması gibi hata ayıklaması zor
  // sorunlarla karşılaşabilirsiniz.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Merkezî kapı: public olmayan yolda oturum yoksa /login. Yenilenmiş auth
  // cookie'leri yönlendirme yanıtına da kopyalanır (Supabase SSR deseni —
  // aksi halde tazelenen token kaybolur ve oturum rastgele düşer).
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Aşağıdakiler hariç tüm istek yollarıyla eşleşir:
     * - _next/static (statik dosyalar)
     * - _next/image (görsel optimizasyonu)
     * - favicon.ico
     * - yaygın görsel uzantıları
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

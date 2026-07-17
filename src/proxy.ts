import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Her istekte Supabase oturumunu (session) yeniler ve auth cookie'lerini
 * hem isteğe hem de yanıta senkronize eder. Server Component'ler bu sayede
 * geçerli bir oturuma erişebilir.
 *
 * Not: Yönlendirme (login'e atma vb.) kuralları, arayüz hazır olduğunda
 * aşağıdaki `user` kontrolü üzerinden eklenebilir.
 */
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

  // Oturum yönlendirme mantığı (arayüz hazır olduğunda doldurulacak):
  // if (!user && !request.nextUrl.pathname.startsWith("/login")) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }
  void user;

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

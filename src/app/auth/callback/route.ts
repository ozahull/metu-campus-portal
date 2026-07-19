import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// İzin verilen kurumsal e-posta alan adları.
const ALLOWED_DOMAINS = ["@metu.edu.tr", "@ncc.metu.edu.tr"];

/**
 * Supabase'in yönlendirdiği callback rotası. Hem Magic Link (OTP) hem de
 * OAuth/PKCE akışında URL'deki `code` parametresini oturuma çevirir,
 * ardından kullanıcının e-posta alan adını doğrular.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Başarılı doğrulama sonrası gidilecek hedef (örn. şifre sıfırlama akışı).
  // Açık yönlendirme (open redirect) önlemek için yalnızca site içi yollara izin
  // ver. GÜVENLİK #10: '//evil.com' (protokol-göreli) ve '/\evil.com'
  // (tarayıcıların '//' gibi yorumladığı) tek '/' kontrolünden geçer — bugün
  // ${origin}${next} öneki istismarı engelliyor ama kod ileride redirect(next)'e
  // dönerse açılırdı; iki biçim de açıkça reddedilir.
  const nextParam = searchParams.get("next");
  const next =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.startsWith("/\\")
      ? nextParam
      : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_domain`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=invalid_domain`);
  }

  const email = data.user.email ?? "";
  const isAllowed = ALLOWED_DOMAINS.some((domain) =>
    email.toLowerCase().endsWith(domain),
  );

  if (!isAllowed) {
    // Geçersiz alan adı: oturumu kapat ve hata ile login'e gönder.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=invalid_domain`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/nav-links";
import { NavMobile } from "@/components/nav-mobile";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserMenu } from "@/components/user-menu";

export const dynamic = "force-dynamic";

function getInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export async function Navbar() {
  const t = await getTranslations("nav");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Navbar yalnızca oturum açık dashboard düzeninde render edilir;
    // oturum yoksa hiçbir şey gösterme (sayfa zaten /login'e yönlenir).
    return null;
  }

  // GİZLİLİK: profiles tablosundan email SEÇME. email kolonu RLS column-grant
  // ile kısıtlıdır (kimse başkasının e-postasını okuyamaz). Kendi e-postanı
  // dahi profiles'tan değil, auth oturumundan (user.email) al.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "";
  const fullName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    email;
  const role = profile?.role ?? "USER";
  const isSuperAdmin = role.toString().trim().toUpperCase() === "SUPER_ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Sol: logo + marka */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* KKK rozeti her iki temada da marka kırmızısında (bg-primary) yaşar. */}
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            KKK
          </span>
          <span className="hidden sm:inline">{t("brand")}</span>
        </Link>

        {/* Linkler logonun hemen yanında, sola kümeli (Linear/GitHub deseni) */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLinks />
        </nav>

        {/* Sağ: ml-auto ile sağa yaslı — tema + dil + (bildirim yeri) + avatar;
            mobilde hamburger. Ortada esneyen boşluk kalır. */}
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeSwitcher />
          <LanguageSwitcher />

          {/* Bildirim yeri: ileride buraya bildirim zili gelecek (şimdilik boş). */}

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <UserMenu
            fullName={fullName}
            email={email}
            role={role}
            isSuperAdmin={isSuperAdmin}
            initials={getInitials(fullName, email)}
          />

          <NavMobile />
        </div>
      </div>
    </header>
  );
}

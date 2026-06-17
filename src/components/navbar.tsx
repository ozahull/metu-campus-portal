import Link from "next/link";
import { CalendarDays, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
    <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Sol: logo + linkler */}
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
          >
            <span
              className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: "#841515" }}
            >
              KKK
            </span>
            <span className="hidden sm:inline">ODTÜ Kampüs Portalı</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/clubs"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <Users className="size-4" />
              Topluluklar
            </Link>
            <Link
              href="/events"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <CalendarDays className="size-4" />
              Etkinlikler
            </Link>
          </nav>
        </div>

        {/* Sağ: admin butonu + avatar menü */}
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-lg border border-[#841515] bg-[#841515]/10 px-3 py-1.5 text-sm font-medium text-[#e7a3a3] transition-colors hover:bg-[#841515] hover:text-white sm:flex"
            >
              <ShieldCheck className="size-4" />
              Yönetim Paneli
            </Link>
          )}

          <UserMenu
            fullName={fullName}
            email={email}
            role={role}
            initials={getInitials(fullName, email)}
          />
        </div>
      </div>
    </header>
  );
}

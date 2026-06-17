import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClubsGrid } from "./clubs-grid";
import { ClubsSkeleton } from "./clubs-skeleton";
import { UpcomingEvents } from "./upcoming-events";

// Route Cache'i devre dışı bırak: her istekte güncel profil/kulüp verisi çekilsin.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("home");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[Dashboard] Profil çekme hatası:", profileError);
  }

  const displayName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email;

  return (
    <main className="dark relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      {/* METU kırmızısı yumuşak ışıma */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Karşılama alanı */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("welcome", { name: displayName ?? "" })}
          </h1>
          <p className="mt-2 text-base text-zinc-400">
            {t("subtitle")}
          </p>
        </header>

        {/* Yaklaşan kampüs etkinlikleri vitrini */}
        <UpcomingEvents />

        {/* Aktif kulüpler */}
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#841515]/15 text-[#e7a3a3]">
            <Compass className="size-4" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-white">
            {t("activeClubs")}
          </h2>
        </div>

        {/* Kulüp ızgarası (yüklenirken skeleton) */}
        <Suspense fallback={<ClubsSkeleton />}>
          <ClubsGrid />
        </Suspense>
      </div>
    </main>
  );
}

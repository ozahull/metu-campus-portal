import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Compass, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/display-name";
import { PageShell } from "@/components/shared/page-shell";
import { SectionHeading } from "@/components/shared/section-heading";
import { ClubsGrid } from "./clubs-grid";
import { ClubsSkeleton } from "./clubs-skeleton";
import { UpcomingEvents } from "./upcoming-events";
import { FairModeDiscovery, type FairClub } from "./fair-mode-discovery";

// Route Cache'i devre dışı bırak: her istekte güncel profil/kulüp verisi çekilsin.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("home") };
}

type RsvpRow = {
  events: { event_date: string; status: string } | { event_date: string; status: string }[] | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ interests?: string }>;
}) {
  const t = await getTranslations("home");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Kulüp Fuarı modu: açıksa dashboard keşif moduna geçer.
  const { data: fairRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fair_mode_enabled")
    .maybeSingle();
  const fairMode = fairRow?.value === "true";

  let fairClubs: FairClub[] = [];
  let fairMemberIds: string[] = [];
  let initialInterests: string[] = [];
  if (fairMode) {
    const sp = await searchParams;
    initialInterests = sp.interests
      ? sp.interests.split(",").filter(Boolean)
      : [];
    const { data: cRaw } = await supabase
      .from("clubs")
      .select("id, name, description, category, logo_url")
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);
    fairClubs = (cRaw ?? []) as FairClub[];
    const { data: mRaw } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id);
    fairMemberIds = (mRaw ?? []).map((m) => m.club_id);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[Dashboard] Profil çekme hatası:", profileError);
  }

  // Hızlı istatistikler (yalnızca sunum): üye olunan kulüp sayısı + yaklaşan
  // katılımlar. RLS: club_members/event_attendees SELECT herkese açık.
  const { count: clubCount } = await supabase
    .from("club_members")
    .select("club_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: rsvpRows } = await supabase
    .from("event_attendees")
    .select("events(event_date, status)")
    .eq("user_id", user.id);

  const now = Date.now();
  const upcomingRsvpCount = ((rsvpRows ?? []) as RsvpRow[]).filter((r) => {
    const ev = Array.isArray(r.events) ? r.events[0] : r.events;
    return (
      ev &&
      ev.status === "APPROVED" &&
      new Date(ev.event_date).getTime() >= now
    );
  }).length;

  // İsim yoksa e-postanın @ öncesi kısmı — ham e-posta karşılamada gösterilmez.
  const displayName =
    resolveDisplayName(
      profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined),
      user.email,
    ) ?? "";

  return (
    <PageShell>
      {/* İşlevsel karşılama: isim + hızlı istatistikler */}
      <header className="mb-10">
        <h1 className="font-display text-2xl font-black tracking-tight text-balance sm:text-3xl">
          {t("welcome", { name: displayName })}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>

        <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
          <StatCard
            icon={Users}
            value={clubCount ?? 0}
            label={t("statClubs")}
          />
          <StatCard
            icon={CalendarCheck}
            value={upcomingRsvpCount}
            label={t("statEvents")}
          />
        </div>
      </header>

      {/* Kulüp Fuarı modu açıksa keşif bölümü (ilgi chip'leri + Sana Göre) */}
      {fairMode && (
        <FairModeDiscovery
          clubs={fairClubs}
          memberClubIds={fairMemberIds}
          userId={user.id}
          initialInterests={initialInterests}
        />
      )}

      {/* Yaklaşan kampüs etkinlikleri (yatay şerit) */}
      <UpcomingEvents />

      {/* Aktif kulüpler */}
      <SectionHeading icon={Compass} title={t("activeClubs")} />
      <Suspense fallback={<ClubsSkeleton />}>
        <ClubsGrid />
      </Suspense>
    </PageShell>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-primary ring-1 ring-primary/15 bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklab,var(--accent-gold)_38%,transparent),color-mix(in_oklab,var(--primary)_16%,transparent))]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-3xl font-black leading-none tracking-tight tabular-nums">
          {value}
        </div>
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

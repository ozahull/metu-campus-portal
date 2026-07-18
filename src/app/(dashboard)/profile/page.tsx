import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Award,
  ArrowRight,
  CalendarClock,
  Crown,
  GraduationCap,
  Inbox,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/datetime";
import { resolveDisplayName } from "@/lib/display-name";
import { PageShell } from "@/components/shared/page-shell";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotificationPreferences } from "@/components/notification-preferences";
import { ProfileVisibilityToggle } from "@/components/profile-visibility-toggle";
import { BadgeShowcase } from "@/components/badges";
import { ProfileForm } from "./profile-form";
import { ProfileDetailsForm } from "./profile-details-form";

// PRIVATE 'avatars' bucket — erişim yalnız signed URL ile (public URL YOK).
const AVATAR_BUCKET = "avatars";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

type ClubLite = { id: string; name: string; logo_url: string | null };
type MembershipRow = {
  role: string;
  clubs: ClubLite | ClubLite[] | null;
};

type RsvpRow = {
  events:
    | { id: string; title: string; event_date: string; status: string }
    | { id: string; title: string; event_date: string; status: string }[]
    | null;
};

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const tBadges = await getTranslations("badges");
  const tRoles = await getTranslations("roles");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  // Rol rozeti (yalnız görsel): ADVISOR → "Hoca", SUPER_ADMIN → "Süper yönetici".
  // Sıradan üyeye (USER) rozet gösterilmez (gürültüyü azalt). Yetki Aşama 2'de.
  const roleKey = profile?.role?.toString().trim().toUpperCase();
  const roleBadge =
    roleKey === "SUPER_ADMIN"
      ? { label: tRoles("superAdmin"), Icon: ShieldCheck }
      : roleKey === "ADVISOR"
        ? { label: tRoles("advisor"), Icon: GraduationCap }
        : null;

  // İsim yoksa e-postanın @ öncesi kısmı — ham e-posta başlıkta gösterilmez.
  const displayName =
    resolveDisplayName(
      profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined),
      user.email,
    ) ?? "";
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // Bildirim tercihi (satır yoksa varsayılan MEMBER_CLUBS).
  const { data: pref } = await supabase
    .from("notification_preferences")
    .select("scope")
    .eq("user_id", user.id)
    .maybeSingle();
  const notifScope = pref?.scope ?? "MEMBER_CLUBS";

  // Kazanılan rozetler (vitrin).
  const { data: badgeRows } = await supabase
    .from("user_badges")
    .select("badge_code")
    .eq("user_id", user.id);
  const earnedBadges = (badgeRows ?? []).map((b) => b.badge_code);

  // Zengin profil alanları (bio/department/class_year/avatar_url) broad SELECT'e
  // KAPALI (kolon-grant: yalnız id/full_name/role). Kendi zengin alanlarını
  // get_profile RPC'siyle çek (self → tüm alanlar dolu gelir).
  const { data: detailsRaw } = await supabase.rpc("get_profile", {
    p_uid: user.id,
  });
  const details = detailsRaw as unknown as {
    bio: string | null;
    department: string | null;
    class_year: string | null;
    avatar_url: string | null;
    hide_profile: boolean | null;
    name_verified: boolean | null;
  } | null;

  // Mevcut avatar önizlemesi: PRIVATE bucket → signed URL (public URL YOK).
  let avatarSignedUrl: string | null = null;
  if (details?.avatar_url) {
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(details.avatar_url, 120);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  // Üye olunan kulüpler
  const { data: membershipRaw } = await supabase
    .from("club_members")
    .select("role, clubs(id, name, logo_url)")
    .eq("user_id", user.id);

  const memberships = ((membershipRaw ?? []) as unknown as MembershipRow[])
    .map((m) => {
      const c = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
      return c
        ? { id: c.id, name: c.name, logoUrl: c.logo_url, role: m.role }
        : null;
    })
    .filter(
      (
        m,
      ): m is { id: string; name: string; logoUrl: string | null; role: string } =>
        m !== null,
    );

  // RSVP'lenen yaklaşan & onaylı etkinlikler
  const { data: rsvpRaw } = await supabase
    .from("event_attendees")
    .select("events(id, title, event_date, status)")
    .eq("user_id", user.id);

  const now = Date.now();
  const rsvps = ((rsvpRaw ?? []) as unknown as RsvpRow[])
    .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events))
    .filter(
      (e): e is { id: string; title: string; event_date: string; status: string } =>
        !!e && e.status === "APPROVED" && new Date(e.event_date).getTime() >= now,
    )
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  // Profil gizleme ayarı yalnız KAMUSAL rol sahiplerine (okul/danışman/başkan)
  // gösterilir; sıradan öğrencinin zengin profili zaten yalnız kendine görünür.
  const isPublicRole =
    roleKey === "SUPER_ADMIN" ||
    roleKey === "ADVISOR" ||
    memberships.some((m) => m.role.toUpperCase() === "ADMIN");

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_92%,transparent),color-mix(in_oklab,var(--accent-ember)_78%,transparent))] text-lg font-bold text-primary-foreground shadow-sm">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            {displayName}
          </h1>
          {user.email && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          )}
          {roleBadge && (
            <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <roleBadge.Icon className="size-3.5" />
              {roleBadge.label}
            </span>
          )}
        </div>
      </header>

      <ProfileForm
        userId={user.id}
        initialName={profile?.full_name ?? ""}
        email={user.email ?? ""}
        nameVerified={details?.name_verified ?? false}
      />

      <div className="mt-6">
        <ProfileDetailsForm
          userId={user.id}
          initialBio={details?.bio ?? ""}
          initialDepartment={details?.department ?? ""}
          initialClassYear={details?.class_year ?? ""}
          initialAvatarUrl={avatarSignedUrl}
          initials={initials}
          displayName={displayName}
        />
      </div>

      <div className="mt-6">
        <NotificationPreferences initialScope={notifScope} />
      </div>

      {isPublicRole && (
        <div className="mt-6">
          <ProfileVisibilityToggle
            userId={user.id}
            initialHidden={details?.hide_profile ?? false}
          />
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Award className="size-4 text-primary" />
            {tBadges("title")}
          </CardTitle>
          <CardDescription>{tBadges("desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <BadgeShowcase earned={earnedBadges} />
        </CardContent>
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kulüplerim */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Users className="size-4 text-primary" />
              {t("myClubs", { count: memberships.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noClubs")}</p>
            ) : (
              <ul className="space-y-2">
                {memberships.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/clubs/${m.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
                    >
                      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-xs font-bold text-foreground">
                        <ImageWithFallback
                          src={m.logoUrl}
                          alt=""
                          sizes="36px"
                          fallback={<span>{m.name.slice(0, 2).toUpperCase()}</span>}
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {m.name}
                      </span>
                      {m.role.toUpperCase() === "ADMIN" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-gold/45 bg-[color-mix(in_oklab,var(--accent-gold)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-accent-gold">
                          <Crown className="size-3" />
                          {t("presidentBadge")}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t("memberBadge")}
                        </span>
                      )}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Katılacağım etkinlikler */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="size-4 text-primary" />
              {t("myEvents", { count: rsvps.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rsvps.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-6 py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Inbox className="size-5" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t("noEvents")}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {rsvps.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="block rounded-lg border border-border bg-muted/40 px-3 py-2.5 transition-colors hover:border-primary/40">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(e.event_date, locale, "short")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

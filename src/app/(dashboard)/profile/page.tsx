import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarClock, Inbox, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/datetime";
import { PageShell } from "@/components/shared/page-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotificationPreferences } from "@/components/notification-preferences";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

type MembershipRow = {
  role: string;
  clubs: { id: string; name: string } | { id: string; name: string }[] | null;
};

type RsvpRow = {
  events:
    | { id: string; title: string; event_date: string; status: string }
    | { id: string; title: string; event_date: string; status: string }[]
    | null;
};

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "";

  // Bildirim tercihi (satır yoksa varsayılan MEMBER_CLUBS).
  const { data: pref } = await supabase
    .from("notification_preferences")
    .select("scope")
    .eq("user_id", user.id)
    .maybeSingle();
  const notifScope = pref?.scope ?? "MEMBER_CLUBS";

  // Üye olunan kulüpler
  const { data: membershipRaw } = await supabase
    .from("club_members")
    .select("role, clubs(id, name)")
    .eq("user_id", user.id);

  const memberships = ((membershipRaw ?? []) as unknown as MembershipRow[])
    .map((m) => {
      const c = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
      return c ? { id: c.id, name: c.name, role: m.role } : null;
    })
    .filter((m): m is { id: string; name: string; role: string } => m !== null);

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

  return (
    <PageShell>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{displayName}</p>
      </header>

      <ProfileForm userId={user.id} initialName={profile?.full_name ?? ""} />

      <div className="mt-6">
        <NotificationPreferences initialScope={notifScope} />
      </div>

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
                    <Link href={`/clubs/${m.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 transition-colors hover:border-primary/40">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      <span className="flex items-center gap-2">
                        {m.role.toUpperCase() === "ADMIN" && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t("presidentBadge")}</span>
                        )}
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </span>
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, Inbox, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

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

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ProfilePage() {
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
    <main className="relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Profilim</h1>
          <p className="mt-1 text-sm text-zinc-400">{displayName}</p>
        </header>

        <ProfileForm userId={user.id} initialName={profile?.full_name ?? ""} />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Kulüplerim */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <Users className="size-4 text-[#e7a3a3]" />
                Kulüplerim ({memberships.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memberships.length === 0 ? (
                <p className="text-sm text-zinc-500">Henüz bir kulübe üye değilsiniz.</p>
              ) : (
                <ul className="space-y-2">
                  {memberships.map((m) => (
                    <li key={m.id}>
                      <Link href={`/clubs/${m.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-[#841515]/40 hover:bg-white/[0.05]">
                        <span className="truncate text-sm font-medium text-zinc-200">{m.name}</span>
                        <span className="flex items-center gap-2">
                          {m.role.toUpperCase() === "ADMIN" && (
                            <span className="rounded-full border border-[#841515]/30 bg-[#841515]/10 px-2 py-0.5 text-[10px] font-medium text-[#e7a3a3]">BAŞKAN</span>
                          )}
                          <ArrowRight className="size-4 text-zinc-500" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Katılacağım etkinlikler */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <CalendarClock className="size-4 text-[#e7a3a3]" />
                Katılacağım Etkinlikler ({rsvps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rsvps.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
                    <Inbox className="size-5" />
                  </div>
                  <p className="mt-3 text-sm text-zinc-500">Yaklaşan katılımınız yok.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {rsvps.map((e) => (
                    <li key={e.id}>
                      <Link href={`/events/${e.id}`} className="block rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-[#841515]/40 hover:bg-white/[0.05]">
                        <p className="truncate text-sm font-medium text-zinc-200">{e.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {dateFormatter.format(new Date(e.event_date))}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

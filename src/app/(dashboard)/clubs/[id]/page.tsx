import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Flame,
  Inbox,
  MapPin,
  SearchX,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { JoinButton } from "./join-button";

export const dynamic = "force-dynamic";

type Club = {
  id: string;
  name: string;
  description: string | null;
  advisor_id: string | null;
};

type MemberProfile = {
  id: string;
  full_name: string | null;
};

type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  event_attendees: { user_id: string }[] | null;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: club, error } = await supabase
    .from("clubs")
    .select("id, name, description, advisor_id")
    .eq("id", id)
    .maybeSingle<Club>();

  if (error) {
    console.error("[ClubDetail] Kulüp çekme hatası:", error);
  }

  // Kulüp üyelerini ve profillerini (isim) çek.
  const { data: membersRaw, error: membersError } = await supabase
    .from("club_members")
    .select("user_id(id, full_name)")
    .eq("club_id", id);

  if (membersError) {
    console.error("[ClubDetail] Üyeler çekme hatası:", membersError);
  }

  // Embed sonucunu düz bir profil listesine normalize et.
  const members: MemberProfile[] = (
    (membersRaw ?? []) as { user_id: MemberProfile | MemberProfile[] | null }[]
  )
    .map((row) => (Array.isArray(row.user_id) ? row.user_id[0] : row.user_id))
    .filter((p): p is MemberProfile => Boolean(p));

  // Mevcut kullanıcı bu kulübe üye mi?
  const isMember = members.some((m) => m.id === user.id);

  // Kullanıcının rolünü çek (etkinlik ekleme yetkisi için).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin =
    profile?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";

  // Kullanıcı bu kulübün yöneticisi mi? (Yönet butonu + yetki için)
  const { data: myMembership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isClubAdmin = myMembership?.role?.toString().toUpperCase() === "ADMIN";
  const isClubAdvisor = club?.advisor_id === user.id;
  const canManage = isSuperAdmin || isClubAdvisor || isClubAdmin;

  // Onaylanmış etkinlikleri tarihe göre artan sırada çek.
  const { data: eventsRaw, error: eventsError } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, location, event_attendees(user_id)",
    )
    .eq("club_id", id)
    .eq("status", "APPROVED")
    .order("event_date", { ascending: true });

  if (eventsError) {
    console.error("[ClubDetail] Etkinlikler çekme hatası:", eventsError);
  }

  const events = (eventsRaw ?? []) as ClubEvent[];

  return (
    <main className="dark relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Geri dön */}
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 gap-1.5 text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <ArrowLeft className="size-4" />
          Geri Dön
        </Link>

        {!club ? (
          // Kulüp bulunamadı durumu
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
              <SearchX className="size-7" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
              Kulüp bulunamadı
            </h1>
            <p className="mt-2 max-w-sm text-sm text-zinc-400">
              Aradığınız kulüp mevcut değil veya kaldırılmış olabilir.
            </p>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-6 gap-2 font-medium text-white hover:opacity-90",
              )}
              style={{ backgroundColor: "#841515" }}
            >
              <ArrowLeft className="size-4" />
              Dashboard&apos;a Dön
            </Link>
          </div>
        ) : (
          <>
            {/* Başlık */}
            <header className="mt-8 mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#841515]/30 bg-[#841515]/10 px-3 py-1 text-xs font-medium text-[#e7a3a3]">
                  <Users className="size-3.5" />
                  Kampüs Topluluğu
                </span>
                <h1
                  className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl"
                  style={{ textShadow: "0 0 40px rgba(132,21,21,0.45)" }}
                >
                  {club.name}
                </h1>
                <div className="mt-4 h-px w-24 bg-gradient-to-r from-[#841515] to-transparent" />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canManage && (
                  <Link
                    href={`/clubs/${club.id}/manage`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "gap-2 border-white/15 bg-transparent text-zinc-200 hover:border-[#841515] hover:bg-[#841515] hover:text-white",
                    )}
                  >
                    <Settings className="size-4" />
                    Yönet
                  </Link>
                )}
                <JoinButton clubId={club.id} userId={user.id} isMember={isMember} />
              </div>
            </header>

            {/* Açıklama kartı */}
            <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">
                  Hakkında
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed text-zinc-300 whitespace-pre-line">
                  {club.description?.trim()
                    ? club.description
                    : "Bu kulüp için henüz bir açıklama eklenmemiş."}
                </p>
              </CardContent>
            </Card>

            {/* Etkinlikler + üyeler bölümleri */}
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <CalendarDays className="size-4 text-[#e7a3a3]" />
                    Yaklaşan Etkinlikler
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length > 0 ? (
                    <ul className="space-y-3">
                      {events.map((ev) => {
                        const attendees = ev.event_attendees ?? [];
                        const isAttending = attendees.some(
                          (a) => a.user_id === user.id,
                        );
                        return (
                          <li
                            key={ev.id}
                            className="rounded-lg border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-[#841515]/40 hover:bg-white/[0.04]"
                          >
                            <h3 className="font-semibold text-white">
                              {ev.title}
                            </h3>
                            {ev.description && (
                              <p className="mt-1 text-sm text-zinc-400">
                                {ev.description}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="size-3.5 text-[#e7a3a3]" />
                                {dateFormatter.format(new Date(ev.event_date))}
                              </span>
                              {ev.location && (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="size-3.5 text-[#e7a3a3]" />
                                  {ev.location}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                                <Flame className="size-3.5 text-orange-400" />
                                {attendees.length} Kişi Katılıyor
                              </span>
                              <RSVPButton
                                eventId={ev.id}
                                userId={user.id}
                                isAttending={isAttending}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
                        <Inbox className="size-5" />
                      </div>
                      <p className="mt-3 text-sm text-zinc-500">
                        Henüz etkinlik bulunmuyor
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <Users className="size-4 text-[#e7a3a3]" />
                    Yönetim &amp; Üyeler
                    <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-zinc-400">
                      {members.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {members.length > 0 ? (
                    <ul className="space-y-2">
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-300">
                            <UserRound className="size-4" />
                          </span>
                          <span className="text-sm font-medium text-zinc-200">
                            {m.full_name ?? "İsimsiz Üye"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
                        <Inbox className="size-5" />
                      </div>
                      <p className="mt-3 text-sm text-zinc-500">
                        Bu kulübe ilk katılan siz olun!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

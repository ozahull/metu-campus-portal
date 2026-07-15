import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarClock, MapPin, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { AddToCalendar } from "./add-to-calendar";
import { EventPhotoWall, type EventPhoto } from "./event-photo-wall";
import { TicketFlow, type MyTicket } from "./ticket-flow";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("title")
    .eq("id", id)
    .maybeSingle<{ title: string }>();
  if (data?.title) return { title: data.title };
  const t = await getTranslations("events");
  return { title: t("title") };
}

type EventClub = {
  id: string;
  name: string;
  ticket_enabled: boolean;
  advisor_id: string | null;
  cover_url: string | null;
};

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  status: string;
  club_id: string;
  ticket_capacity: number | null;
  ticket_deadline: string | null;
  clubs: EventClub | EventClub[] | null;
  event_attendees: { user_id: string }[] | null;
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("events");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, location, status, club_id, ticket_capacity, ticket_deadline, clubs(id, name, ticket_enabled, advisor_id, cover_url), event_attendees(user_id)",
    )
    .eq("id", id)
    .maybeSingle<EventDetail>();

  if (error) {
    console.error("[EventDetail] Etkinlik çekme hatası:", error);
  }

  // Öğrenci yalnızca onaylı etkinliği görebilir (RLS de korur).
  if (!data || data.status !== "APPROVED") {
    redirect("/events");
  }

  const club = Array.isArray(data.clubs) ? data.clubs[0] : data.clubs;
  const attendees = data.event_attendees ?? [];
  const isAttending = attendees.some((a) => a.user_id === user.id);

  // Bilet akışı OPT-IN: yalnızca kulüp bu etkinlikte katılım biletini (QR)
  // açtıysa gösterilir (ticket_enabled). Ödeme/fiyat yok — bilet ücretsiz.
  // Opt-in kapalıysa klasik RSVP (event_attendees) korunur.
  const ticketingOn = Boolean(club?.ticket_enabled);

  // Kapak: etkinlikte alan yok → kulübün kapağı (tam URL). Kapasite barı:
  // ticket_capacity tanımlıysa katılımcı/kontenjan doluluk oranı.
  const coverUrl = club?.cover_url ?? null;
  const capacity =
    data.ticket_capacity && Number(data.ticket_capacity) > 0
      ? Number(data.ticket_capacity)
      : null;
  const filledPct = capacity
    ? Math.min(100, Math.round((attendees.length / capacity) * 100))
    : null;

  // Etkinlik geçmişse fotoğraf duvarı gösterilir. Yetki (yükle/sil): kulübün
  // başkanı/danışmanı/okul.
  const isPast = new Date(data.event_date).getTime() < Date.now();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperAdmin =
    profileRow?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";
  const { data: myMembership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", data.club_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isClubAdmin = myMembership?.role?.toString().toUpperCase() === "ADMIN";
  const isClubAdvisor = club?.advisor_id === user.id;
  const canManagePhotos = isSuperAdmin || isClubAdmin || isClubAdvisor;

  let photos: EventPhoto[] = [];
  if (isPast) {
    const { data: photoRows } = await supabase
      .from("event_photos")
      .select("id, storage_path, caption")
      .eq("event_id", data.id)
      .order("created_at", { ascending: false });
    photos = (photoRows ?? []).map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      caption: p.caption,
      url: supabase.storage.from("club-images").getPublicUrl(p.storage_path).data
        .publicUrl,
    }));
  }

  // Kullanıcının bu etkinlik için biletini çek (varsa).
  let myTicket: MyTicket | null = null;
  if (ticketingOn) {
    const { data: t } = await supabase
      .from("tickets")
      .select("id, token, status")
      .eq("event_id", data.id)
      .eq("user_id", user.id)
      .maybeSingle<MyTicket>();
    myTicket = t ?? null;
  }

  return (
    <main className="relative">
      {/* Kapak HERO — foto ya da gün batımı gradyanı + başlık overlay (mockup 1g) */}
      <div className="relative h-60 w-full overflow-hidden sm:h-72 lg:h-80">
        {/* Gün batımı gradyan zemini (foto yoksa/yüklenemezse görünür) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(140deg,color-mix(in_oklab,var(--primary)_92%,transparent),color-mix(in_oklab,var(--accent-ember)_78%,transparent))]"
        />
        <ImageWithFallback
          src={coverUrl}
          alt=""
          sizes="100vw"
          priority
          fallback={null}
        />
        {/* Okunurluk perdesi (alttan sıcak koyu → üstte şeffaf) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(0deg,color-mix(in_oklab,var(--primary)_72%,transparent),color-mix(in_oklab,var(--primary)_20%,transparent)_45%,transparent_75%)]"
        />

        {/* Geri dön çipi (sol üst) */}
        <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 lg:px-8">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
          >
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Link>
        </div>

        {/* Başlık bloğu (alt) */}
        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-5xl flex-col px-4 pb-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            {club && (
              <Link
                href={`/clubs/${club.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/25"
              >
                <Users className="size-3.5" />
                {club.name}
              </Link>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm">
              <Ticket className="size-3" />
              {t("free")}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-balance text-primary-foreground drop-shadow-sm sm:text-4xl">
            {data.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
        {/* İki sütun: sol içerik + sağ yapışkan katılım kartı */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* Sol: açıklama + geçmiş fotoğraflar + takvim (mobilde CTA'dan sonra) */}
          <div className="order-2 min-w-0 space-y-6 lg:order-1">
            {data.description?.trim() && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-display text-lg font-bold tracking-tight">
                  {t("about")}
                </h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">
                  {data.description}
                </p>
              </section>
            )}

            {isPast && (
              <EventPhotoWall
                eventId={data.id}
                photos={photos}
                canManage={canManagePhotos}
              />
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {t("addToCalendar")}
              </p>
              <AddToCalendar
                title={data.title}
                description={data.description}
                location={data.location}
                startISO={data.event_date}
              />
            </div>
          </div>

          {/* Sağ: yapışkan katılım/bilet kartı (tarih, konum, kontenjan, CTA);
              mobilde hero'nun hemen altında (order-1). */}
          <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-6 lg:h-fit">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-2.5 text-sm">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  {formatDateTime(data.event_date, locale, "long")}
                </span>
              </div>
              {data.location && (
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0">{data.location}</span>
                </div>
              )}

              {/* Kontenjan barı (ticket_capacity tanımlıysa) ya da katılımcı sayısı */}
              {capacity ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {t("attendingCount", { count: attendees.length })}
                    </span>
                    <span className="tabular-nums">
                      {attendees.length}/{capacity}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--accent-ember))]"
                      style={{ width: `${filledPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-sm">
                  <Users className="size-4 shrink-0 text-primary" />
                  {t("attendingCount", { count: attendees.length })}
                </div>
              )}
            </div>

            {/* Katılım / bilet CTA'sı */}
            {ticketingOn ? (
              <TicketFlow
                eventId={data.id}
                closesAtISO={data.ticket_deadline ?? data.event_date}
                ticket={myTicket}
              />
            ) : (
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
                <RSVPButton
                  eventId={data.id}
                  userId={user.id}
                  isAttending={isAttending}
                  className="h-11 w-full justify-center text-sm"
                />
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

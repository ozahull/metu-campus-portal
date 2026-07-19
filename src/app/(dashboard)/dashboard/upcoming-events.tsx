import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, CalendarX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAttendanceCounts } from "@/lib/attendance";
import { fetchMyTicketEventIds } from "@/lib/my-tickets";
import { SectionHeading } from "@/components/shared/section-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, type EventCardData } from "@/components/shared/event-card";

type Attendee = { user_id: string };

type Club = { name: string; cover_url: string | null; ticket_enabled: boolean };

type UpcomingEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  clubs: Club | Club[] | null;
  event_attendees: Attendee[] | null;
};

function firstClub(clubs: UpcomingEvent["clubs"]): Club | null {
  if (!clubs) return null;
  return Array.isArray(clubs) ? (clubs[0] ?? null) : clubs;
}

export async function UpcomingEvents() {
  const t = await getTranslations("home");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, event_date, location, clubs(name, cover_url, ticket_enabled), event_attendees(user_id)",
    )
    .eq("status", "APPROVED")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(8);

  if (error) {
    console.error("[Dashboard] Yaklaşan etkinlikler çekme hatası:", error);
  }

  const events = (data ?? []) as UpcomingEvent[];

  // Detayla BİREBİR aynı sayı: biletli etkinlikte bilet, RSVP'de attendees
  // (tek batch RPC). Hata/eksikte event_attendees sayısına düşülür.
  const counts = await fetchAttendanceCounts(
    supabase,
    events.map((e) => e.id),
  );
  // Kart bilet durumu (EK1): kullanıcının bu etkinliklerdeki biletleri.
  const myTickets = user
    ? await fetchMyTicketEventIds(
        supabase,
        user.id,
        events.map((e) => e.id),
      )
    : new Set<string>();

  return (
    <section className="mb-12">
      <SectionHeading
        icon={CalendarDays}
        title={t("upcomingTitle")}
        action={
          events.length > 0 ? (
            <Link
              href="/events"
              className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("seeAll")}
              <ArrowRight className="size-4" />
            </Link>
          ) : undefined
        }
      />

      {events.length === 0 ? (
        <EmptyState icon={CalendarX} title={t("noUpcoming")} />
      ) : (
        // Yatay kaydırılabilir şerit (mobilde swipe). -mx ile kenardan kenara kayar.
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [scrollbar-width:thin]">
          <div className="flex snap-x snap-mandatory gap-4">
            {events.map((ev) => {
              const attendees = ev.event_attendees ?? [];
              const club = firstClub(ev.clubs);
              const cardData: EventCardData = {
                id: ev.id,
                title: ev.title,
                eventDate: ev.event_date,
                location: ev.location,
                clubName: club?.name ?? null,
                coverUrl: club?.cover_url ?? null,
                attendeeCount: counts[ev.id] ?? attendees.length,
              };
              return (
                <div
                  key={ev.id}
                  className="w-72 shrink-0 snap-start sm:w-80"
                >
                  <EventCard
                    event={cardData}
                    ticket={{
                      ticketed: Boolean(club?.ticket_enabled),
                      hasTicket: myTickets.has(ev.id),
                    }}
                    rsvp={
                      user
                        ? {
                            userId: user.id,
                            isAttending: attendees.some(
                              (a) => a.user_id === user.id,
                            ),
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

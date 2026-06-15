import { CalendarDays, Clock, Flame, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RSVPButton } from "@/components/shared/rsvp-button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Attendee = { user_id: string };

type UpcomingEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_attendees: Attendee[] | null;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function clubName(clubs: UpcomingEvent["clubs"]): string | null {
  if (!clubs) return null;
  return Array.isArray(clubs) ? (clubs[0]?.name ?? null) : clubs.name;
}

export async function UpcomingEvents() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, location, clubs(name), event_attendees(user_id)")
    .eq("status", "APPROVED")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(5);

  if (error) {
    console.error("[Dashboard] Yaklaşan etkinlikler çekme hatası:", error);
  }

  const events = (data ?? []) as UpcomingEvent[];

  return (
    <section className="mb-12">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#841515]/15 text-[#e7a3a3]">
          <CalendarDays className="size-4" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Yaklaşan Kampüs Etkinlikleri
        </h2>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-zinc-900/30 px-5 py-6 text-sm text-zinc-500">
          Şu an planlanan bir etkinlik yok.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((ev) => {
            const name = clubName(ev.clubs);
            const attendees = ev.event_attendees ?? [];
            const attendeeCount = attendees.length;
            const isAttending = user
              ? attendees.some((a) => a.user_id === user.id)
              : false;

            return (
              <Card
                key={ev.id}
                className="flex flex-col border-white/5 bg-zinc-900/50 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-[#841515]/50 hover:shadow-[0_8px_30px_-8px_rgba(132,21,21,0.45)]"
              >
                <CardHeader>
                  {name && (
                    <p className="text-xs lowercase tracking-wide text-zinc-500">
                      düzenleyen: {name}
                    </p>
                  )}
                  <CardTitle className="text-base font-semibold text-white">
                    {ev.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-1.5 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-[#e7a3a3]" />
                      {dateFormatter.format(new Date(ev.event_date))}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-[#e7a3a3]" />
                        {ev.location}
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                    <Flame className="size-3.5 text-orange-400" />
                    {attendeeCount} Kişi Katılıyor
                  </span>
                  {user && (
                    <RSVPButton
                      eventId={ev.id}
                      userId={user.id}
                      isAttending={isAttending}
                    />
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

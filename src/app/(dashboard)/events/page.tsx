import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EventsExplorer, type EventRow } from "./events-explorer";

export const dynamic = "force-dynamic";

type EventQueryRow = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  club_id: string;
  clubs: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
  event_attendees: { user_id: string }[] | null;
};

export default async function EventsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, event_date, location, club_id, clubs(name, category), event_attendees(user_id)",
    )
    .eq("status", "APPROVED")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[Events] Etkinlikler çekme hatası:", error);
  }

  const events: EventRow[] = ((data ?? []) as unknown as EventQueryRow[]).map(
    (e) => {
      const club = Array.isArray(e.clubs) ? e.clubs[0] : e.clubs;
      return {
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        location: e.location,
        club_id: e.club_id,
        club_name: club?.name ?? null,
        category: club?.category ?? null,
        attendees: e.event_attendees?.length ?? 0,
      };
    },
  );

  return (
    <main className="relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#841515]/15 text-[#e7a3a3]">
            <CalendarDays className="size-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Etkinlikler
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Kampüsteki yaklaşan etkinlikleri keşfedin ve katılın.
            </p>
          </div>
        </header>

        <EventsExplorer events={events} />
      </div>
    </main>
  );
}

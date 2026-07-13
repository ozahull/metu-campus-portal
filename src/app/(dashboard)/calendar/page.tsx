import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { CalendarView, type CalendarEvent } from "./calendar-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

type RsvpRow = {
  events:
    | {
        id: string;
        title: string;
        event_date: string;
        location: string | null;
        status: string;
        clubs: { name: string } | { name: string }[] | null;
      }
    | {
        id: string;
        title: string;
        event_date: string;
        location: string | null;
        status: string;
        clubs: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

export default async function CalendarPage() {
  const t = await getTranslations("calendar");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Kullanıcının RSVP'leri → onaylı & gelecek etkinlikler.
  const { data } = await supabase
    .from("event_attendees")
    .select("events(id, title, event_date, location, status, clubs(name))")
    .eq("user_id", user.id);

  const now = Date.now();
  const events: CalendarEvent[] = ((data ?? []) as unknown as RsvpRow[])
    .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events))
    .filter(
      (e): e is NonNullable<typeof e> =>
        !!e &&
        e.status === "APPROVED" &&
        new Date(e.event_date).getTime() >= now,
    )
    .map((e) => {
      const club = Array.isArray(e.clubs) ? e.clubs[0] : e.clubs;
      return {
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        location: e.location,
        club_name: club?.name ?? null,
      };
    });

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      <CalendarView events={events} />
    </PageShell>
  );
}

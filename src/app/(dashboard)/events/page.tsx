import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { EventsExplorer, type EventRow } from "./events-explorer";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: t("title") };
}

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
  const t = await getTranslations("events");
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
      const att = e.event_attendees ?? [];
      return {
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        location: e.location,
        club_id: e.club_id,
        club_name: club?.name ?? null,
        category: club?.category ?? null,
        attendees: att.length,
        attending: att.some((a) => a.user_id === user.id),
      };
    },
  );

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      <EventsExplorer events={events} userId={user.id} />
    </PageShell>
  );
}

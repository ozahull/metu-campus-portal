"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, type EventCardData } from "@/components/shared/event-card";

export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  club_id: string;
  club_name: string | null;
  category: string | null;
  attendees: number;
  attending: boolean;
};

const selectClass =
  "h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-card";

export function EventsExplorer({
  events,
  userId,
}: {
  events: EventRow[];
  userId: string;
}) {
  const t = useTranslations("events");
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("");
  const [category, setCategory] = useState("");

  const clubs = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.club_id && e.club_name) map.set(e.club_id, e.club_name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [events]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.category) set.add(e.category);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q)) return false;
      if (club && e.club_id !== club) return false;
      if (category && e.category !== category) return false;
      return true;
    });
  }, [events, query, club, category]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 text-base"
          />
        </div>
        <select
          className={selectClass}
          value={club}
          onChange={(e) => setClub(e.target.value)}
          aria-label={t("clubFilter")}
        >
          <option value="">{t("allClubs")}</option>
          {clubs.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {categories.length > 0 && (
          <select
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label={t("categoryFilter")}
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const cardData: EventCardData = {
              id: e.id,
              title: e.title,
              eventDate: e.event_date,
              location: e.location,
              clubName: e.club_name,
              category: e.category,
              attendeeCount: e.attendees,
            };
            return (
              <EventCard
                key={e.id}
                event={cardData}
                rsvp={{ userId, isAttending: e.attending }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

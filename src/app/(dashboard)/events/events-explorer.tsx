"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCard, type EventCardData } from "@/components/shared/event-card";
import { categoryLabel } from "@/lib/category";
import { normalizeSearchText, searchIncludes } from "@/lib/search-text";
import { cn } from "@/lib/utils";

export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  club_id: string;
  club_name: string | null;
  category: string | null;
  cover_url: string | null;
  attendees: number;
  attending: boolean;
};

// text-base mobil: iOS Safari 16px altındaki form kontrolüne odakta kalıcı
// zoom yapar — küçük görünüm yalnız md+ (ui/input deseni).
const selectClass =
  "h-11 rounded-full border border-border bg-card px-4 text-base text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-card md:text-sm";

/** Kategori filtresi pill chip'i — seçili dolu primary, diğerleri outline. */
function chipCls(active: boolean): string {
  return cn(
    "h-9 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:border-primary/50",
  );
}

export function EventsExplorer({
  events,
  userId,
}: {
  events: EventRow[];
  userId: string;
}) {
  const t = useTranslations("events");
  const tCategories = useTranslations("categories");
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
    // Türkçe-güvenli arama (O18) — bkz. src/lib/search-text.ts.
    const q = normalizeSearchText(query.trim());
    return events.filter((e) => {
      if (q && !searchIncludes(e.title, q)) return false;
      if (club && e.club_id !== club) return false;
      if (category && e.category !== category) return false;
      return true;
    });
  }, [events, query, club, category]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-full pl-11 text-base"
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
      </div>

      {/* Kategori pill chip dizisi (seçili = dolu kırmızı, diğerleri outline) */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={category === ""}
            onClick={() => setCategory("")}
            className={chipCls(category === "")}
          >
            {t("allCategories")}
          </button>
          {/* Etiket çevrilir; filtre eşleşmesi HAM DB değeriyle kalır. */}
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory((prev) => (prev === c ? "" : c))}
              className={chipCls(category === c)}
            >
              {categoryLabel(c, tCategories)}
            </button>
          ))}
        </div>
      )}

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
              coverUrl: e.cover_url,
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

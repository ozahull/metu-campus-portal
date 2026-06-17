"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Clock, Flame, MapPin, Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type EventRow = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  club_id: string;
  club_name: string | null;
  category: string | null;
  attendees: number;
};

const selectClass =
  "h-11 rounded-lg border border-white/10 bg-zinc-900/60 px-3 text-sm text-white outline-none focus-visible:border-[#841515] [&>option]:bg-zinc-900";

export function EventsExplorer({ events }: { events: EventRow[] }) {
  const t = useTranslations("events");
  const locale = useLocale();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );
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
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 border-white/10 bg-zinc-900/60 pl-10 text-base text-white placeholder:text-zinc-500"
          />
        </div>
        <select className={selectClass} value={club} onChange={(e) => setClub(e.target.value)} aria-label={t("clubFilter")}>
          <option value="">{t("allClubs")}</option>
          {clubs.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        {categories.length > 0 && (
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("categoryFilter")}>
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
            <SearchX className="size-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-300">
            {t("emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {t("emptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <Card
              key={e.id}
              className="group flex flex-col border-white/5 bg-zinc-900/50 transition-all duration-300 hover:-translate-y-1 hover:border-[#841515]/50 hover:shadow-[0_8px_30px_-8px_rgba(132,21,21,0.45)]"
            >
              <CardHeader>
                <p className="text-xs text-zinc-500">
                  {e.club_name ?? "—"}
                  {e.category ? ` · ${e.category}` : ""}
                </p>
                <CardTitle className="text-base font-semibold text-white">
                  {e.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-1.5 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-[#e7a3a3]" />
                    {dateFormatter.format(new Date(e.event_date))}
                  </span>
                  {e.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#e7a3a3]" />
                      {e.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Flame className="size-3.5 text-orange-400" />
                    {t("attendees", { count: e.attendees })}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Link
                  href={`/events/${e.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#e7a3a3] transition-colors hover:text-white"
                >
                  {t("viewDetail")}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

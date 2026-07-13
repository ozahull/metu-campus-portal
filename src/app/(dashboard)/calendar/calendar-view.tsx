"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CalendarX, Clock, MapPin, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  club_name: string | null;
};

// Varsayılan etkinlik süresi (bitiş bilgisi olmadığından) — çakışma tespiti için.
const DURATION_MS = 2 * 60 * 60 * 1000;

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [offset, setOffset] = useState(0); // 0 = bu hafta, 1 = gelecek hafta

  // Çakışma: aynı 2 saatlik pencerede kesişen etkinlikler (tüm RSVP'ler üzerinde).
  const conflicts = useMemo(() => {
    const s = new Set<string>();
    const arr = events.map((e) => ({
      id: e.id,
      start: new Date(e.event_date).getTime(),
    }));
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (
          arr[i].start < arr[j].start + DURATION_MS &&
          arr[j].start < arr[i].start + DURATION_MS
        ) {
          s.add(arr[i].id);
          s.add(arr[j].id);
        }
      }
    }
    return s;
  }, [events]);

  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // Pazartesi = 0
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dow,
    );
    const ws = new Date(monday);
    ws.setDate(monday.getDate() + offset * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 7);
    return { weekStart: ws, weekEnd: we };
  }, [offset]);

  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const rangeFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });

  const groups = useMemo(() => {
    const weekEvents = events
      .filter((e) => {
        const ts = new Date(e.event_date).getTime();
        return ts >= weekStart.getTime() && ts < weekEnd.getTime();
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    const map = new Map<string, { date: Date; items: CalendarEvent[] }>();
    for (const e of weekEvents) {
      const d = new Date(e.event_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = map.get(key);
      if (!g) {
        g = { date: d, items: [] };
        map.set(key, g);
      }
      g.items.push(e);
    }
    return [...map.values()];
  }, [events, weekStart, weekEnd]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label={t("weekToggle")}
          className="inline-flex rounded-lg border border-border bg-card p-0.5"
        >
          {[0, 1].map((o) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={offset === o}
              onClick={() => setOffset(o)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                offset === o
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(o === 0 ? "thisWeek" : "nextWeek")}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {rangeFmt.format(weekStart)} –{" "}
          {rangeFmt.format(new Date(weekEnd.getTime() - 86_400_000))}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={CalendarX} title={t("empty")} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.date.toISOString()}>
              <h2 className="mb-2 px-1 text-sm font-semibold tracking-tight text-muted-foreground">
                {dayFmt.format(g.date)}
              </h2>
              <ul className="space-y-2">
                {g.items.map((e) => {
                  const conflict = conflicts.has(e.id);
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/events/${e.id}`}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                      >
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                          <Clock className="size-3.5" />
                          {timeFmt.format(new Date(e.event_date))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold tracking-tight">
                              {e.title}
                            </span>
                            {conflict && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                                <AlertTriangle className="size-3" />
                                {t("conflict")}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {e.club_name && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="size-3.5" />
                                {e.club_name}
                              </span>
                            )}
                            {e.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3.5" />
                                <span className="truncate">{e.location}</span>
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

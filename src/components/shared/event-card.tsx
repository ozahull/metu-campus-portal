import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Clock, MapPin, Users } from "lucide-react";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { DateBadge } from "@/components/shared/date-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EventCardData = {
  id: string;
  title: string;
  eventDate: string;
  location: string | null;
  clubName: string | null;
  category?: string | null;
  attendeeCount: number;
};

/**
 * Paylaşılan etkinlik kartı: tarih rozeti + kulüp/kategori + tarih/konum +
 * katılımcı sayısı + opsiyonel RSVP. Dashboard şeridi, /events ve kulüp
 * detayında aynı görünümü sağlar.
 */
export function EventCard({
  event,
  rsvp,
  className,
}: {
  event: EventCardData;
  rsvp?: { userId: string; isAttending: boolean };
  className?: string;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const date = new Date(event.eventDate);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

  return (
    <div
      className={cn(
        "group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <DateBadge date={date} locale={locale} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {event.clubName && (
              <span className="truncate text-xs font-medium text-primary">
                {event.clubName}
              </span>
            )}
            {event.category && <Badge>{event.category}</Badge>}
          </div>
          <Link
            href={`/events/${event.id}`}
            className="mt-1 block font-semibold tracking-tight text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
          >
            <span className="line-clamp-2">{event.title}</span>
          </Link>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" />
          {dateLabel}
        </span>
        {event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="size-3.5" />
          {t("attendeeCount", { count: event.attendeeCount })}
        </span>
        {rsvp && (
          <RSVPButton
            eventId={event.id}
            userId={rsvp.userId}
            isAttending={rsvp.isAttending}
          />
        )}
      </div>
    </div>
  );
}

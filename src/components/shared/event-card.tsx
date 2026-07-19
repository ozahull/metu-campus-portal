import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Clock, MapPin, Ticket, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { DateBadge } from "@/components/shared/date-badge";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/category";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type EventCardData = {
  id: string;
  title: string;
  eventDate: string;
  location: string | null;
  clubName: string | null;
  category?: string | null;
  attendeeCount: number;
  /** Kapak görseli (etkinlikte alan yoksa kulübün cover_url'ü). Tam URL. */
  coverUrl?: string | null;
};

/**
 * Paylaşılan etkinlik kartı (Dil A — fotoğraf öncelikli). Üstte 16:9 kapak:
 * cover_url varsa fotoğraf, yoksa sıcak gün batımı gradyanı + başlığın filigran
 * ilk harfi (kırık görsel ikonu YOK — ImageWithFallback + fallback=null).
 * Kapak köşesinde tarih çipi (DateBadge). Altında kulüp/kategori, Gabarito
 * başlık (line-clamp-2), tarih/konum, katılımcı + opsiyonel RSVP. Dashboard
 * şeridi, /events grid ve kulüp detayı üçü de bunu kullanır.
 */
export function EventCard({
  event,
  rsvp,
  ticket,
  className,
}: {
  event: EventCardData;
  rsvp?: { userId: string; isAttending: boolean };
  /** Biletli etkinlik bilgisi: kart, DETAY sayfasıyla aynı mantığı gösterir —
   *  bileti olana "Biletin var", biletli-ama-biletsize "Bilet Al" (detaya
   *  gider); RSVP butonu YALNIZ biletsiz (RSVP) etkinlikte render edilir. */
  ticket?: { ticketed: boolean; hasTicket: boolean };
  className?: string;
}) {
  const t = useTranslations("home");
  const tCategories = useTranslations("categories");
  const locale = useLocale();
  const date = new Date(event.eventDate);
  const dateLabel = formatDateTime(date, locale, "short");
  const watermark = (
    event.title?.trim()?.[0] ??
    event.clubName?.trim()?.[0] ??
    "•"
  ).toUpperCase();

  return (
    <div
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_14px_34px_-14px_color-mix(in_oklab,var(--primary)_38%,transparent)]",
        className,
      )}
    >
      {/* Kapak (16:9) — foto ya da gün batımı filigran placeholder */}
      <Link
        href={`/events/${event.id}`}
        aria-label={event.title}
        className="relative block aspect-[16/9] w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Gün batımı gradyan zemini (foto yoksa/yüklenemezse görünür) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(140deg,color-mix(in_oklab,var(--primary)_88%,transparent),color-mix(in_oklab,var(--accent-ember)_72%,transparent))]"
        />
        {/* Filigran ilk harf */}
        <span
          aria-hidden="true"
          className="absolute -right-3 -bottom-8 select-none font-display text-[7rem] leading-none font-black text-primary-foreground/15"
        >
          {watermark}
        </span>
        {/* Kapak fotoğrafı (varsa foto zemini kaplar) */}
        <ImageWithFallback
          src={event.coverUrl}
          alt=""
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          fallback={null}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        {/* Tarih çipi (kapağa binen) */}
        <DateBadge
          date={date}
          locale={locale}
          className="absolute top-3 left-3 size-13 border-transparent bg-card/90 shadow-md backdrop-blur-sm"
        />
      </Link>

      {/* Gövde */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {event.clubName && (
            <span className="truncate text-xs font-medium text-primary">
              {event.clubName}
            </span>
          )}
          {event.category && (
            <Badge>{categoryLabel(event.category, tCategories)}</Badge>
          )}
        </div>

        <Link
          href={`/events/${event.id}`}
          className="mt-1 block focus-visible:underline focus-visible:outline-none"
        >
          <span className="line-clamp-2 font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {event.title}
          </span>
        </Link>

        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
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
          {ticket?.hasTicket ? (
            <Link
              href={`/events/${event.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 border-success/40 bg-success/15 text-success hover:bg-success/25 hover:text-success",
              )}
            >
              <Ticket className="size-3.5" />
              {t("hasTicket")}
            </Link>
          ) : ticket?.ticketed ? (
            <Link
              href={`/events/${event.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 border-primary/50 hover:border-primary hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <Ticket className="size-3.5" />
              {t("getTicket")}
            </Link>
          ) : (
            rsvp && (
              <RSVPButton
                eventId={event.id}
                userId={rsvp.userId}
                isAttending={rsvp.isAttending}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

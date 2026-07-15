"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/datetime";
import { notificationIcon, type AppNotification } from "@/lib/notification-meta";
import { cn } from "@/lib/utils";

/**
 * Tek bir bildirim satırı (hem zil panelinde hem /notifications sayfasında
 * kullanılır). Sistem tiplerinde başlık i18n etiketidir, alt satır veri
 * (etkinlik/kulüp adı); CLUB_ANNOUNCEMENT'te başlık = duyuru başlığı (veri),
 * alt satır = duyuru gövdesi.
 */
export function NotificationItem({
  n,
  onActivate,
}: {
  n: AppNotification;
  onActivate: (n: AppNotification) => void;
}) {
  const t = useTranslations("notifications");
  const tb = useTranslations("badges");
  const locale = useLocale();
  const Icon = notificationIcon(n.type);
  const isAnnounce = n.type === "CLUB_ANNOUNCEMENT";
  const isBadge = n.type === "BADGE_EARNED";
  const primary = isAnnounce ? n.title : t(`type.${n.type}`);
  // BADGE_EARNED'te title = rozet kodu; kod → isim çevirisi. Duyuruda gövde,
  // diğer sistem tiplerinde başlık alanı (etkinlik/kulüp adı) alt satırdır.
  const secondary = isAnnounce
    ? n.body
    : isBadge
      ? tb(`${n.title}.name`)
      : n.title;
  const unread = !n.read_at;

  return (
    <button
      type="button"
      onClick={() => onActivate(n)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        unread && "bg-[color-mix(in_oklab,var(--accent-ember)_9%,transparent)]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          unread
            ? "bg-[color-mix(in_oklab,var(--accent-ember)_16%,transparent)] text-accent-ember"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {primary}
          </span>
          {unread && (
            <span
              className="size-2 shrink-0 rounded-full bg-accent-ember"
              aria-hidden
            />
          )}
        </span>
        {secondary && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {secondary}
          </span>
        )}
        <span className="mt-1 block text-[11px] text-muted-foreground/80">
          {formatDateTime(n.created_at, locale, "short")}
        </span>
      </span>
    </button>
  );
}

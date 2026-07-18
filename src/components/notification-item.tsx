"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/datetime";
import { notificationIcon, type AppNotification } from "@/lib/notification-meta";
import { cn } from "@/lib/utils";

// CLUB_REQUEST bildiriminde body bir MAKİNE token'ı taşır (veri değil); bilinen
// token'lar UI'da yerelleştirilir, tanınmayan/boş değerde genel etikete düşülür.
const CLUB_REQUEST_TOKENS = ["NEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED"];

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
  const isClubRequest = n.type === "CLUB_REQUEST";
  const isMessage = n.type === "MESSAGE";
  // CLUB_REQUEST'te primary = body token'ına göre değişen etiket (kime
  // gösterildiğine göre metin — NEW yöneticiye, diğerleri başvurana). Bilinmeyen/
  // boş token'da sessizce bozulma yerine genel t("type.CLUB_REQUEST")'e düş.
  // MESSAGE'ta title = gönderen adı (VERİ); ad yoksa trigger 'MESSAGE' makine
  // token'ı yazar → genel t("type.MESSAGE") etiketine düş.
  const primary = isMessage
    ? n.title === "MESSAGE"
      ? t("type.MESSAGE")
      : n.title
    : isAnnounce
      ? n.title
      : isClubRequest
        ? n.body && CLUB_REQUEST_TOKENS.includes(n.body)
          ? t(`clubRequest.${n.body}`)
          : t("type.CLUB_REQUEST")
        : t(`type.${n.type}`);
  // BADGE_EARNED'te title = rozet kodu; kod → isim çevirisi. CLUB_REQUEST'te
  // title = topluluk adı (veri). Duyuruda ve MESSAGE'ta gövde (duyuru içeriği /
  // mesaj önizlemesi), diğer sistem tiplerinde başlık alanı (etkinlik/kulüp
  // adı) alt satırdır.
  const secondary = isMessage
    ? n.body
    : isAnnounce
      ? n.body
      : isBadge
        ? tb(`${n.title}.name`)
        : isClubRequest
          ? n.title
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
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {formatDateTime(n.created_at, locale, "short")}
        </span>
      </span>
    </button>
  );
}

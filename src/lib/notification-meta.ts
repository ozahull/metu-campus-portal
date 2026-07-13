// Bildirim tipi → ikon eşlemesi (ortak). Kullanıcıya gösterilen ETİKETLER
// i18n'den (notifications.type.*) gelir; burada yalnızca görsel ikon eşlemesi
// vardır. Bildirim satırının `title`/`body` alanları VERİ/serbest metindir
// (etkinlik/kulüp adı, duyuru içeriği) — çeviriye tabi değildir.

import {
  Bell,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Images,
  Megaphone,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<string, LucideIcon> = {
  EVENT_APPROVED: CalendarCheck,
  EVENT_NEW: CalendarPlus,
  EVENT_REMINDER: Clock,
  CLUB_ANNOUNCEMENT: Megaphone,
  MEMBERSHIP: UserRoundCheck,
  EVENT_PHOTOS: Images,
};

export function notificationIcon(type: string): LucideIcon {
  return ICONS[type] ?? Bell;
}

// Dış bağlantı mı (yeni sekme) yoksa uygulama içi yol mu?
export function isExternalLink(link: string | null): boolean {
  return !!link && /^https?:\/\//i.test(link);
}

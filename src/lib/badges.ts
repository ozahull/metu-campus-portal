// Rozet kataloğu (görsel + sıralama). İsim/ipucu metinleri i18n'den (badges.*)
// gelir; burada yalnızca kod sırası ve ikon eşlemesi vardır.

import {
  Award,
  Crown,
  Flame,
  PartyPopper,
  Rocket,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export const BADGE_ORDER = [
  "FIRST_EVENT",
  "FIVE_EVENTS",
  "TEN_EVENTS",
  "FOUNDING_MEMBER",
  "CLUB_LEADER",
] as const;



const ICONS: Record<string, LucideIcon> = {
  FIRST_EVENT: PartyPopper,
  FIVE_EVENTS: Flame,
  TEN_EVENTS: Trophy,
  FOUNDING_MEMBER: Rocket,
  CLUB_LEADER: Crown,
};

export function badgeIcon(code: string): LucideIcon {
  return ICONS[code] ?? Award;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CalendarDays,
  Home,
  MessagesSquare,
  Ticket,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/dashboard", key: "home", icon: Home },
  { href: "/clubs", key: "communities", icon: Users },
  { href: "/events", key: "events", icon: CalendarDays },
  { href: "/calendar", key: "calendar", icon: CalendarClock },
] as const;

/**
 * Ana gezinme linkleri, aktif sayfa göstergeli. Masaüstü varyantı responsive:
 * md-lg arası YALNIZ İKON (metin gizli, aria-label + title ile erişilebilir,
 * dokunma hedefi >=44px), lg+ ikon + metin — 6 öğe 768px'te taşmadan sığar,
 * öğeler asla satır kırmaz (whitespace-nowrap). Mobilde (md altı) bu bileşen
 * drawer içinde tam genişlik satırlar olarak render edilir (NavMobile).
 * "Mesajlar" koşulludur: yalnız en az bir mesaj kanalı olan kullanıcıya
 * görünür (showMessages — navbar list_my_conversations'tan besler).
 */
export function NavLinks({
  variant = "desktop",
  onNavigate,
  showMessages = false,
  messagesUnread = 0,
}: {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  showMessages?: boolean;
  messagesUnread?: number;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tMessages = useTranslations("messages");

  // Biletlerim herkese görünür; Mesajlar koşullu ve ondan önce gelir.
  const links = [
    ...baseLinks,
    ...(showMessages
      ? [{ href: "/messages", key: "messages", icon: MessagesSquare } as const]
      : []),
    { href: "/tickets", key: "tickets", icon: Ticket } as const,
  ];

  const unreadBadge = messagesUnread > 99 ? "99+" : String(messagesUnread);

  return (
    <>
      {links.map(({ href, key, icon: Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === href
            : pathname.startsWith(href);
        const label = t(key);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            // İkon-only halde erişilebilir isim + fare tooltipi.
            aria-label={label}
            title={variant === "desktop" ? label : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              variant === "desktop"
                ? // md-lg: ikon-only, >=44px dokunma hedefi; lg+: pill + metin.
                  "min-h-11 min-w-11 justify-center px-2.5 py-1.5 text-sm lg:min-h-0 lg:min-w-0 lg:justify-start lg:px-3"
                : "px-3 py-2.5 text-base",
              active
                ? "bg-primary/10 text-primary hover:bg-muted"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon
              className={variant === "desktop" ? "size-5 lg:size-4" : "size-5"}
            />
            <span className={variant === "desktop" ? "hidden lg:inline" : undefined}>
              {label}
            </span>
            {key === "messages" && messagesUnread > 0 && (
              <span
                aria-label={tMessages("unreadBadgeAria", {
                  count: messagesUnread,
                })}
                className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
              >
                {unreadBadge}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

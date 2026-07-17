"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CalendarDays,
  Home,
  MessagesSquare,
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
 * Ana gezinme linkleri, aktif sayfa göstergeli. Masaüstünde yatay pill'ler,
 * mobilde tam genişlik satırlar (drawer içinde). Aktiflik usePathname ile.
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

  const links = showMessages
    ? [
        ...baseLinks,
        { href: "/messages", key: "messages", icon: MessagesSquare } as const,
      ]
    : [...baseLinks];

  const unreadBadge = messagesUnread > 99 ? "99+" : String(messagesUnread);

  return (
    <>
      {links.map(({ href, key, icon: Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === href
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              variant === "desktop"
                ? "px-3 py-1.5 text-sm"
                : "px-3 py-2.5 text-base",
              active
                ? "bg-primary/10 text-primary hover:bg-muted"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={variant === "desktop" ? "size-4" : "size-5"} />
            {t(key)}
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

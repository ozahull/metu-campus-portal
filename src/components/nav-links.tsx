"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Home, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", key: "home", icon: Home },
  { href: "/clubs", key: "communities", icon: Users },
  { href: "/events", key: "events", icon: CalendarDays },
] as const;

/**
 * Ana gezinme linkleri, aktif sayfa göstergeli. Masaüstünde yatay pill'ler,
 * mobilde tam genişlik satırlar (drawer içinde). Aktiflik usePathname ile.
 */
export function NavLinks({
  variant = "desktop",
  onNavigate,
}: {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

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
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className={variant === "desktop" ? "size-4" : "size-5"} />
            {t(key)}
          </Link>
        );
      })}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages, LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setLocale } from "@/i18n/locale-actions";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeLabels: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

type UserMenuProps = {
  fullName: string;
  email: string;
  role: string;
  initials: string;
};

export function UserMenu({ fullName, email, role, initials }: UserMenuProps) {
  const router = useRouter();
  const t = useTranslations("userMenu");
  const activeLocale = useLocale();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function changeLocale(locale: Locale) {
    if (locale === activeLocale) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 ring-offset-zinc-950 transition focus-visible:ring-2 focus-visible:ring-[#841515]">
        <Avatar className="size-9 border border-white/10">
          <AvatarFallback className="bg-[#841515] text-sm font-semibold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="dark w-60 border-white/10 bg-zinc-900 text-foreground"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white">{fullName}</span>
            <span className="truncate text-xs text-zinc-400">{email}</span>
            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-[#841515]/30 bg-[#841515]/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#e7a3a3]">
              {role}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          render={
            <Link href="/profile" className="gap-2">
              <UserRound className="size-4" />
              {t("profile")}
            </Link>
          }
        />

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Dil seçimi */}
        <DropdownMenuLabel className="flex items-center gap-2 py-1 text-xs font-normal text-zinc-500">
          <Languages className="size-3.5" />
          {t("language")}
        </DropdownMenuLabel>
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => changeLocale(loc)}
            disabled={isPending}
            className="gap-2"
          >
            <Check
              className={cn(
                "size-4",
                loc === activeLocale ? "text-[#e7a3a3]" : "opacity-0",
              )}
            />
            {localeLabels[loc]}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={loading}
          className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-300"
        >
          <LogOut className="size-4" />
          {loading ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

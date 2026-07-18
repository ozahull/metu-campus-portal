"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { setLocale } from "@/i18n/locale-actions";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeLabels: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

/** Dil değiştirici (navbar). Cookie tabanlı; setLocale aksiyonu route'u
 *  sunucu tarafında refresh() ile yeniden render ettirir (Next 16). */
export function LanguageSwitcher() {
  const t = useTranslations("userMenu");
  const activeLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  function changeLocale(locale: Locale) {
    if (locale === activeLocale) return;
    startTransition(async () => {
      await setLocale(locale);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language")}
        title={t("language")}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages className="size-[1.15rem]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
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
                loc === activeLocale ? "text-primary" : "opacity-0",
              )}
            />
            {localeLabels[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

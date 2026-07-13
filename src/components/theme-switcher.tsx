"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sun/Moon tema değiştirici (dil switcher deseniyle). İkonlar CSS `dark:`
 * varyantıyla değişir — bu sayede SSR flash / hidrasyon uyuşmazlığı olmaz.
 * Tıklama, çözülen temaya göre açık↔koyu geçiş yapar.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label={t("toggle")}
      title={t("toggle")}
      onClick={() =>
        setTheme(mounted && resolvedTheme === "dark" ? "light" : "dark")
      }
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Sun className="hidden size-[1.15rem] dark:block" />
      <Moon className="block size-[1.15rem] dark:hidden" />
    </button>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { badgeIcon, BADGE_ORDER } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * Profil rozet vitrini: tüm rozetler; kazanılanlar renkli, kazanılmayanlar
 * soluk + "nasıl kazanılır" ipucu. Sıralama tablosu / puan YOK.
 */
export function BadgeShowcase({ earned }: { earned: string[] }) {
  const t = useTranslations("badges");
  const earnedSet = new Set(earned);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {BADGE_ORDER.map((code) => {
        const Icon = badgeIcon(code);
        const has = earnedSet.has(code);
        return (
          <div
            key={code}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition-colors",
              has
                ? "border-primary/30 bg-primary/5"
                : "border-dashed border-border bg-muted/30",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                has
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground/60",
              )}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold",
                  !has && "text-muted-foreground",
                )}
              >
                {t(`${code}.name`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {has ? t("earned") : t(`${code}.hint`)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Üye listesi için küçük rozet ikon dizisi (yalnız kazanılanlar). İpucu native
 * title ile.
 */
export function BadgeIconRow({ codes }: { codes: string[] }) {
  const t = useTranslations("badges");
  if (codes.length === 0) return null;
  const ordered = BADGE_ORDER.filter((c) => codes.includes(c));
  return (
    <span className="inline-flex items-center gap-1">
      {ordered.map((code) => {
        const Icon = badgeIcon(code);
        return (
          <span
            key={code}
            title={t(`${code}.name`)}
            className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Icon className="size-3" />
          </span>
        );
      })}
    </span>
  );
}

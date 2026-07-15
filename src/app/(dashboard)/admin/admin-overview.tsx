"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  Inbox,
  Users,
} from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { FairModeToggle } from "./fair-mode-toggle";
import type { Overview } from "./admin-analytics";
import type { PendingEvent } from "./admin-approvals";

/**
 * Genel Bakış (Dil B, YENİ): hoca girince 3 saniyede "ne durumda, ne bekliyor".
 * Üstte stat kartları (hairline, UPPERCASE etiket, tabular-nums sayı — Gabarito
 * YOK), altında bekleyen onay önizlemesi (+ "tümü" → Onay Kuyruğu) ve kampüs
 * geneli Fuar Modu anahtarı (Kulüpler formundan buraya taşındı).
 */
export function AdminOverview({
  overview,
  pending,
  pendingCount,
  fairEnabled,
  onSeeApprovals,
}: {
  overview: Overview | null;
  pending: PendingEvent[];
  pendingCount: number;
  fairEnabled: boolean;
  onSeeApprovals: () => void;
}) {
  const t = useTranslations("admin.overview");
  const locale = useLocale();

  const stats = [
    { label: t("statClubs"), value: overview?.total_clubs ?? 0, icon: Building2, accent: false },
    { label: t("statPending"), value: pendingCount, icon: ClipboardList, accent: pendingCount > 0 },
    { label: t("statEvents"), value: overview?.total_events ?? 0, icon: CalendarDays, accent: false },
    { label: t("statMembers"), value: overview?.total_members ?? 0, icon: Users, accent: false },
  ];
  const preview = pending.slice(0, 4);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-base font-semibold tracking-tight">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Stat kartları */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                {s.label}
              </span>
              <s.icon
                className={cn(
                  "size-4 shrink-0",
                  s.accent ? "text-primary" : "text-muted-foreground",
                )}
              />
            </div>
            <div
              className={cn(
                "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
                s.accent ? "text-primary" : "text-foreground",
              )}
            >
              {Number(s.value).toLocaleString(locale)}
            </div>
          </div>
        ))}
      </div>

      {/* Bekleyen onay önizlemesi */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            {t("pendingTitle")}
          </h3>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onSeeApprovals}
              className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("pendingAll")}
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
        {preview.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Inbox className="size-4" />
            {t("pendingEmpty")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {preview.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    {ev.club_name ?? "—"}
                  </p>
                  <p className="truncate text-sm font-medium">{ev.title}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  <Clock className="size-3.5" />
                  {formatDateTime(ev.event_date, locale, "short")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kampüs geneli Fuar Modu anahtarı */}
      <FairModeToggle initialEnabled={fairEnabled} />
    </section>
  );
}

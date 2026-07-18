"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { NotificationItem } from "@/components/notification-item";
import { isExternalLink, type AppNotification } from "@/lib/notification-meta";
import { DAY_MS, startOfAppDay } from "@/lib/datetime";

type Group = { key: "today" | "week" | "older"; items: AppNotification[] };

// D27: gün sınırı KAMPÜS gününe göre (Europe/Istanbul) — tarayıcı-yerel
// new Date(y,m,d) İstanbul dışındaki tarayıcıda sınırı kaydırıyordu.
// startOfAppDay 4dafb0c datetime katmanından.
function groupByDate(items: AppNotification[]): Group[] {
  const startToday = startOfAppDay(Date.now()).getTime();
  const weekStart = startToday - 6 * DAY_MS; // son 7 gün

  const today: AppNotification[] = [];
  const week: AppNotification[] = [];
  const older: AppNotification[] = [];
  for (const n of items) {
    const ts = new Date(n.created_at).getTime();
    if (ts >= startToday) today.push(n);
    else if (ts >= weekStart) week.push(n);
    else older.push(n);
  }
  return [
    { key: "today", items: today },
    { key: "week", items: week },
    { key: "older", items: older },
  ].filter((g) => g.items.length > 0) as Group[];
}

export function NotificationsView({
  initialItems,
}: {
  initialItems: AppNotification[];
}) {
  const router = useRouter();
  const t = useTranslations("notifications");
  const [items, setItems] = useState<AppNotification[]>(initialItems);

  const groups = useMemo(() => groupByDate(items), [items]);
  const hasUnread = items.some((n) => !n.read_at);

  async function activate(n: AppNotification) {
    if (!n.read_at) {
      const nowIso = new Date().toISOString();
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: nowIso } : x)),
      );
      const supabase = createClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: nowIso })
        .eq("id", n.id);
      // Hata: optimistic işareti geri al + sabit uyarı. Gezinme yine de devam eder.
      if (error) {
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read_at: null } : x)),
        );
        toast.error(t("markError"));
      }
    }
    if (n.link) {
      if (isExternalLink(n.link)) {
        window.open(n.link, "_blank", "noopener,noreferrer");
      } else {
        router.push(n.link);
      }
    }
  }

  async function markAllRead() {
    const nowIso = new Date().toISOString();
    const prevItems = items;
    setItems((prev) =>
      prev.map((x) => (x.read_at ? x : { ...x, read_at: nowIso })),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso })
      .is("read_at", null);
    if (error) {
      setItems(prevItems);
      toast.error(t("markError"));
      return;
    }
    // Navbar'ı (server) tazele: bildirim zili badge'i taze okunmamış sayısıyla
    // (0) yeniden render olsun — reload beklemeden. Zil prop'tan senkronlar.
    router.refresh();
  }

  if (items.length === 0) {
    return <EmptyState icon={Bell} title={t("empty")} />;
  }

  return (
    <div className="space-y-6">
      {hasUnread && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            className="gap-1.5 rounded-full text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="size-4" />
            {t("markAllRead")}
          </Button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(
              g.key === "today"
                ? "groupToday"
                : g.key === "week"
                  ? "groupWeek"
                  : "groupOlder",
            )}
          </h2>
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {g.items.map((n) => (
              <li key={n.id} className="border-b border-border last:border-0">
                <NotificationItem n={n} onActivate={activate} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

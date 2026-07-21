"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { refreshAfterMutation } from "@/lib/refresh";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { NotificationItem } from "@/components/notification-item";
import {
  isExternalLink,
  isSafeInternalPath,
  type AppNotification,
} from "@/lib/notification-meta";
import { DAY_MS, startOfAppDay } from "@/lib/datetime";

// Ölçek (Commit 1): sayfa boyutu + ortak kolon listesi. Server ilk sayfayı
// NOTIFICATIONS_PAGE_SIZE+1 ile çeker; buradaki "daha fazla yükle" aynı boyu
// keyset (created_at,id) ile sürdürür. Kolonlar tek kaynaktan (server + client
// aynı seti seçsin).
export const NOTIFICATIONS_PAGE_SIZE = 30;
export const NOTIFICATION_COLS = "id, type, title, body, link, read_at, created_at";

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
  userId,
  initialItems,
  initialHasMore,
  initialUnread,
}: {
  userId: string;
  initialItems: AppNotification[];
  initialHasMore: boolean;
  initialUnread: number;
}) {
  const router = useRouter();
  const t = useTranslations("notifications");
  const [items, setItems] = useState<AppNotification[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  // Okunmamış sayısı AYRI (otoritatif). "Tümünü okundu işaretle" görünürlüğü
  // buna bağlı — yüklenmiş sayfada okunmamış olmasa bile sonraki sayfada olabilir.
  const [unread, setUnread] = useState(initialUnread);

  const groups = useMemo(() => groupByDate(items), [items]);

  // Realtime: yeni bildirim gelince TÜM listeyi yeniden çekme — yalnız satırı
  // listenin BAŞINA ekle (en yeni üstte) ve okunmamış sayacını artır. Fallback
  // polling YOK: bu tam liste görünümü, bell'den bağımsız kanal adı kullanır.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-page:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Partial<AppNotification> & { id?: string };
          if (!row?.id) return;
          const incoming: AppNotification = {
            id: row.id,
            type: row.type ?? "",
            title: row.title ?? "",
            body: row.body ?? null,
            link: row.link ?? null,
            read_at: row.read_at ?? null,
            created_at: row.created_at ?? new Date().toISOString(),
          };
          setItems((prev) =>
            prev.some((x) => x.id === incoming.id)
              ? prev
              : [incoming, ...prev],
          );
          if (!incoming.read_at) setUnread((u) => u + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // "Daha fazla yükle" — keyset (created_at DESC, id DESC), OFFSET DEĞİL. Son
  // öğeyi cursor alır; eşit created_at ilelerinde id ile ayrışır (tek işlemde
  // toplu eklenen bildirimler aynı created_at'i paylaşabilir). +1 çekip taşmayı
  // ölçer; sayfa boyu kadarını ekler.
  const loadMore = useCallback(async () => {
    if (loadingMore || items.length === 0) return;
    setLoadingMore(true);
    const cursor = items[items.length - 1];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_COLS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      )
      .limit(NOTIFICATIONS_PAGE_SIZE + 1);
    setLoadingMore(false);
    if (error) {
      toast.error(t("loadError"));
      return;
    }
    const rows = (data ?? []) as AppNotification[];
    const more = rows.length > NOTIFICATIONS_PAGE_SIZE;
    const page = rows.slice(0, NOTIFICATIONS_PAGE_SIZE);
    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...page.filter((x) => !seen.has(x.id))];
    });
    setHasMore(more);
  }, [items, loadingMore, t]);

  async function activate(n: AppNotification) {
    if (!n.read_at) {
      const nowIso = new Date().toISOString();
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: nowIso } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
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
        setUnread((u) => u + 1);
        toast.error(t("markError"));
      }
    }
    if (n.link) {
      if (isExternalLink(n.link)) {
        window.open(n.link, "_blank", "noopener,noreferrer");
      } else if (isSafeInternalPath(n.link)) {
        router.push(n.link);
      }
      // Aksi (örn. '//evil.com'): gezinme YOK — yalnız okundu işaretlenir (#4).
    }
  }

  async function markAllRead() {
    const nowIso = new Date().toISOString();
    const prevItems = items;
    const prevUnread = unread;
    setItems((prev) =>
      prev.map((x) => (x.read_at ? x : { ...x, read_at: nowIso })),
    );
    setUnread(0);
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso })
      .is("read_at", null);
    if (error) {
      setItems(prevItems);
      setUnread(prevUnread);
      toast.error(t("markError"));
      return;
    }
    // Navbar'ı (server) tazele: bildirim zili badge'i taze okunmamış sayısıyla
    // (0) yeniden render olsun — reload beklemeden. Zil prop'tan senkronlar.
    await refreshAfterMutation(router);
  }

  if (items.length === 0) {
    return <EmptyState icon={Bell} title={t("empty")} />;
  }

  return (
    <div className="space-y-6">
      {unread > 0 && (
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

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            className="gap-1.5 rounded-full"
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" />}
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

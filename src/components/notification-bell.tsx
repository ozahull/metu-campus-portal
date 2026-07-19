"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { NotificationItem } from "@/components/notification-item";
import {
  isExternalLink,
  isSafeInternalPath,
  type AppNotification,
} from "@/lib/notification-meta";
import { cn } from "@/lib/utils";

const SELECT_COLS = "id, type, title, body, link, read_at, created_at";

export function NotificationBell({
  userId,
  initialItems,
  initialUnread,
}: {
  userId: string;
  initialItems: AppNotification[];
  initialUnread: number;
}) {
  const router = useRouter();
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sunucu (navbar) tazelendiğinde (router.refresh) otoritatif ilk veriyle
  // senkronla. useState yalnız mount'ta prop alır; /notifications sayfasındaki
  // "tümünü okundu işaretle" router.refresh() ile navbar'ı yeniden render eder
  // ve buradaki senkron sayaç/badge'i (0'a) hemen düşürür — reload beklemeden.
  // Prop'lar yalnız server yeniden render olunca değişir (istemci gezinme
  // navbar'ı korur), bu yüzden yerel optimistic/realtime güncellemeler ezilmez.
  useEffect(() => {
    setItems(initialItems);
    setUnread(initialUnread);
  }, [initialItems, initialUnread]);

  // Son 10 bildirimi + okunmamış sayısını sunucudan tazele (otoritatif).
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(10);
    if (data) setItems(data as AppNotification[]);
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setUnread(count ?? 0);
  }, []);

  // Realtime: notifications INSERT dinlenir; olay gelince otoritatif tazele.
  // Fallback: 60 sn'lik polling (realtime kurulamazsa da sayaç güncel kalır).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const interval = setInterval(() => {
      void refresh();
    }, 60000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, refresh]);

  // Dışarı tıklama + Escape ile kapat.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function activate(n: AppNotification) {
    setOpen(false);
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
      // Hata: optimistic işareti geri al + sabit yerelleştirilmiş uyarı (ham
      // error.message gösterme). Gezinme okundu işaretinden bağımsız devam eder.
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
    // RLS: yalnızca kendi okunmamış satırları güncellenir.
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso })
      .is("read_at", null);
    if (error) {
      setItems(prevItems);
      setUnread(prevUnread);
      toast.error(t("markError"));
    }
  }

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("bellAria", { count: unread })}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-[1.15rem]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobil arka plan (sheet hissi) */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/10 sm:hidden"
          />
          <div
            className={cn(
              "fixed inset-x-2 top-16 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              "sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:max-h-[28rem] sm:w-96",
            )}
            role="dialog"
            aria-label={t("title")}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold">{t("title")}</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <CheckCheck className="size-3.5" />
                  {t("markAllRead")}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-1">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Bell className="size-5" />
                  </span>
                  <p className="text-sm text-muted-foreground">{t("empty")}</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {items.map((n) => (
                    <li key={n.id}>
                      <NotificationItem n={n} onActivate={activate} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border p-1">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t("seeAll")}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

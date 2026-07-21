"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronUp, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { refreshAfterMutation } from "@/lib/refresh";
import { knownErrorKey } from "@/lib/known-errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { appDayKey, DAY_MS, formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  // Gönderen silinmişse SET NULL ile null olur ("silinmiş kullanıcı").
  sender_user_id: string | null;
  body: string;
  created_at: string;
  sender: { full_name: string | null } | null;
};

// Ölçek (Commit 3): thread artık sabit 200 sınırıyla eski mesajları GİZLEMEZ.
// Son MESSAGES_PAGE_SIZE mesaj yüklenir; "daha eski" ile keyset (created_at,id)
// sayfalama yukarı doğru. HİÇBİR mesaj kaybolmaz (offset yok, sessiz kesme yok).
export const MESSAGES_PAGE_SIZE = 50;
export const MESSAGE_COLS =
  "id, sender_user_id, body, created_at, sender:sender_user_id(full_name)";

// Gün ayracı karşılaştırması KAMPÜS (Europe/Istanbul) takvim günüyle yapılır
// (appDayKey) — yerel getter'lar sunucu (UTC) ve tarayıcıda farklı güne
// düşüp hydration uyuşmazlığı yaratıyordu.

/**
 * Mesaj balonları + composer (Aşama 4B). Realtime/polling YOK; gönderim
 * optimistic append (insert→select) ile, badge'ler refreshAfterMutation ile.
 * "Daha eski mesajları yükle" cursor tabanlı — eski mesajlar erişilebilir.
 */
export function MessageThread({
  conversationId,
  currentUserId,
  canWrite,
  initialMessages,
  initialHasOlder,
}: {
  conversationId: string;
  currentUserId: string;
  canWrite: boolean;
  initialMessages: ThreadMessage[];
  initialHasOlder: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("messages");
  const locale = useLocale();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Bir sonraki layout'ta ne yapılacağı: "bottom" (mount/gönderim → en alta),
  // "preserve" (daha eski eklendi → görüntü aynı mesajda kalsın), null (dokunma).
  const scrollIntentRef = useRef<"bottom" | "preserve" | null>("bottom");
  const prevScrollHeightRef = useRef(0);

  // Kaydırma yönetimi: yeni mesaj altta → en alta in; eski mesaj üstte → viewport
  // aynı mesajda kalsın (yukarı zıplama yok). useLayoutEffect: boyama öncesi.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const intent = scrollIntentRef.current;
    scrollIntentRef.current = null;
    if (intent === "bottom") {
      el.scrollTop = el.scrollHeight;
    } else if (intent === "preserve") {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
    }
  }, [messages]);

  // OKUNDU imleci — YALNIZ istemci mount'unda, BİR KEZ. Server render'da
  // işaretlemek YASAK: Link prefetch server component'i tetikler → kanal hiç
  // açılmadan sayaç sıfırlanırdı. conversation_reads upsert'i 4A'nın BELGELİ
  // istisnasıdır (tablo düzeyi grant; profiles upsert yasağı burada geçersiz).
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("conversation_reads")
      .upsert(
        {
          conversation_id: conversationId,
          user_id: currentUserId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" },
      )
      .then(({ error }) => {
        if (error) {
          console.error("[messages] okundu işaretleme hatası:", error);
          return;
        }
        // Navbar + inbox rozetlerini (unread_count) otoritatif düşür.
        void refreshAfterMutation(router);
      });
  }, [conversationId, currentUserId, router]);

  // "Daha eski mesajları yükle" — keyset (created_at DESC, id DESC), OFFSET yok.
  // En eski yüklü mesaj cursor; +1 çekip daha eskisi VAR mı ölçer; kronolojiye
  // çevirip listenin BAŞINA ekler. Viewport preserve ile yukarı zıplamaz.
  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[0];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLS)
      .eq("conversation_id", conversationId)
      .or(
        `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGES_PAGE_SIZE + 1);
    setLoadingOlder(false);
    if (error) {
      console.error("[messages] daha eski mesaj hatası:", error);
      toast.error(t("loadOlderError"));
      return;
    }
    const rows = (data ?? []) as ThreadMessage[];
    const more = rows.length > MESSAGES_PAGE_SIZE;
    const older = rows.slice(0, MESSAGES_PAGE_SIZE).reverse(); // kronolojik
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
      scrollIntentRef.current = "preserve";
    }
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...older.filter((m) => !seen.has(m.id)), ...prev];
    });
    setHasOlder(more);
  }, [conversationId, loadingOlder, messages, t]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0 || sending) return;

    setSending(true);
    const supabase = createClient();
    // YALNIZ iki kolon gönderilir: sender_user_id DEFAULT auth.uid() ile
    // dolar — istemci gönderirse kolon-grant 42501 verir (4A). Eklenen satır
    // select ile GERİ okunur → optimistic append (kayan pencere boşluğu YOK).
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, body: trimmed })
      .select(MESSAGE_COLS)
      .single();
    setSending(false);

    if (error) {
      console.error("[messages] mesaj gönderme hatası:", error);
      // Bilinen hız sınırı (güvenlik #5) ayırt edilir; kalanı generic.
      const known = knownErrorKey(error.message, [
        ["Çok hızlı mesaj", "sendRateLimit"],
      ]);
      toast.error(known ? t(known) : t("sendError"));
      return;
    }
    const sent = data as ThreadMessage | null;
    if (sent) {
      scrollIntentRef.current = "bottom";
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent],
      );
    }
    setBody("");
    // Badge/inbox (unread/last_message) için server tazele; mesaj listesi
    // yerel state'te — bu refresh listeyi SIFIRLAMAZ (state mount'ta seed'lenir).
    await refreshAfterMutation(router);
  }

  // Gün ayracı etiketi: bugün/dün çevirisi, aksi halde salt-tarih biçimi
  // (formatDateTime "dateOnly" = medium tarih, saat yok).
  function dayLabel(date: Date): string {
    const now = Date.now();
    const key = appDayKey(date);
    if (key === appDayKey(now)) return t("day.today");
    if (key === appDayKey(now - DAY_MS)) return t("day.yesterday");
    return formatDateTime(date, locale, "dateOnly");
  }

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex max-h-[60svh] min-h-72 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card/40 p-4"
      >
        {hasOlder && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="gap-1.5 rounded-full text-muted-foreground"
            >
              {loadingOlder ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ChevronUp className="size-4" />
              )}
              {t("loadOlder")}
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">
            {t("threadEmpty")}
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_user_id === currentUserId;
            const date = new Date(m.created_at);
            // Kampüs takvim günü bir önceki mesajdan farklıysa (ilk mesaj
            // dahil) mesajın üstüne ortalanmış gün çipi (Aşama 4C).
            const showDayChip =
              i === 0 ||
              appDayKey(messages[i - 1].created_at) !== appDayKey(date);
            return (
              <Fragment key={m.id}>
                {showDayChip && (
                  <div className="mx-auto rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {dayLabel(date)}
                  </div>
                )}
                <div
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3.5 py-2.5 sm:max-w-[70%]",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card",
                    )}
                  >
                    {!mine &&
                      (m.sender_user_id === null ? (
                        // Gönderen hesabı silinmiş (FK SET NULL) → mesaj kalır.
                        <p className="mb-0.5 text-xs font-semibold text-muted-foreground italic">
                          {t("deletedUser")}
                        </p>
                      ) : (
                        m.sender?.full_name && (
                          <p className="mb-0.5 text-xs font-semibold text-primary">
                            {m.sender.full_name}
                          </p>
                        )
                      ))}
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {m.body}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        mine
                          ? "text-primary-foreground/85"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDateTime(m.created_at, locale, "short")}
                    </p>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      {canWrite ? (
        <form onSubmit={handleSend} className="mt-4 flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("composerPlaceholder")}
            aria-label={t("composerPlaceholder")}
            maxLength={4000}
            rows={2}
            disabled={sending}
            className="min-h-11 flex-1 resize-none bg-background"
          />
          <Button
            type="submit"
            disabled={sending || body.trim().length === 0}
            className="h-11 shrink-0 gap-1.5 px-4"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {t("send")}
          </Button>
        </form>
      ) : (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>{t("readOnly")}</p>
        </div>
      )}
    </div>
  );
}

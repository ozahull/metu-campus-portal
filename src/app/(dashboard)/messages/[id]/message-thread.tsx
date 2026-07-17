"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string | null } | null;
};

/**
 * Mesaj balonları + composer (Aşama 4B). Realtime/polling YOK — gönderim ve
 * okundu işareti sonrası router.refresh() ile server verisi tazelenir.
 */
export function MessageThread({
  conversationId,
  currentUserId,
  canWrite,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  canWrite: boolean;
  initialMessages: ThreadMessage[];
}) {
  const router = useRouter();
  const t = useTranslations("messages");
  const locale = useLocale();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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
        router.refresh();
      });
  }, [conversationId, currentUserId, router]);

  // Mount'ta (ve yeni mesaj gelince) en alta in — yeni mesajlar altta.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [initialMessages.length]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0 || sending) return;

    setSending(true);
    const supabase = createClient();
    // YALNIZ iki kolon gönderilir: sender_user_id DEFAULT auth.uid() ile
    // dolar — istemci gönderirse kolon-grant 42501 verir (4A).
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, body: trimmed });
    setSending(false);

    if (error) {
      console.error("[messages] mesaj gönderme hatası:", error);
      toast.error(t("sendError"));
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div>
      <div className="flex max-h-[60svh] min-h-72 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card/40 p-4">
        {initialMessages.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">
            {t("threadEmpty")}
          </p>
        ) : (
          initialMessages.map((m) => {
            const mine = m.sender_user_id === currentUserId;
            return (
              <div
                key={m.id}
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
                  {!mine && m.sender?.full_name && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">
                      {m.sender.full_name}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {m.body}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      mine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatDateTime(m.created_at, locale, "short")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} aria-hidden />
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

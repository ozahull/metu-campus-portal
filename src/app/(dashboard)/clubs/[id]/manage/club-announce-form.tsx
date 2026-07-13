"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClubAnnounceForm({ clubId }: { clubId: string }) {
  const t = useTranslations("manage.announce");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim().length === 0 || body.trim().length === 0) {
      toast.error(t("toasts.titleRequired"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // club_announce (SECURITY DEFINER): yetki + spam kontrolü RPC içinde;
    // tüm üyelere CLUB_ANNOUNCEMENT bildirimi üretir, üretilen sayıyı döner.
    const { data, error } = await supabase.rpc("club_announce", {
      p_club_id: clubId,
      p_title: title.trim(),
      p_body: body.trim(),
      p_link: link.trim() || undefined,
    });
    setLoading(false);

    if (error) {
      toast.error(t("toasts.error", { message: error.message }));
      return;
    }

    toast.success(t("toasts.sent", { count: data ?? 0 }));
    setTitle("");
    setBody("");
    setLink("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <Megaphone className="size-4 text-primary" />
        {t("title")}
      </p>

      <div className="space-y-2">
        <Label htmlFor="announce-title">{t("fieldTitle")}</Label>
        <Input
          id="announce-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          disabled={loading}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="announce-body">{t("fieldBody")}</Label>
        <Textarea
          id="announce-body"
          rows={4}
          className="resize-none"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("bodyPlaceholder")}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="announce-link">{t("fieldLink")}</Label>
        <Input
          id="announce-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={t("linkPlaceholder")}
          disabled={loading}
          inputMode="url"
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t("desc")}</p>
        <Button
          type="submit"
          disabled={loading}
          className="shrink-0 gap-1.5 font-medium"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {loading ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

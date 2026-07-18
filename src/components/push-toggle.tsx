"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
  getPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { cn } from "@/lib/utils";

// Aşama 5B — Web Push aç/kapat anahtarı (NotificationPreferences kartının alt
// bölümü). Durum HEM tarayıcı aboneliğinden HEM de DB'den doğrulanır: yalnız
// pushManager'da abonelik olması yetmez — o aboneliğin DB satırının GERÇEKTEN
// mevcut kullanıcıya ait olması gerekir (RLS: kişi yalnız kendi satırını görür).
// Aksi halde ortak cihazda önceki kullanıcıdan kalan tarayıcı aboneliği "açık"
// gösterirdi; uyuşmazlıkta toggle KAPALI görünür (K2 düzeltmesi).
export function PushToggle() {
  const t = useTranslations("notifications.push");
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) {
        if (!cancelled) {
          setSupported(false);
          setReady(true);
        }
        return;
      }
      const sub = await getPushSubscription();
      // Tarayıcı aboneliği var → DB'de bu endpoint'in MEVCUT kullanıcıya ait bir
      // satırı var mı? RLS SELECT yalnız user_id=auth.uid() satırlarını döndürdüğü
      // için, satır dönerse bu cihaz gerçekten bu kullanıcıya kayıtlıdır. Başka
      // kullanıcıdan kalan bayat abonelik burada null döner → toggle KAPALI.
      let mine = false;
      if (sub) {
        const supabase = createClient();
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", sub.endpoint)
          .maybeSingle();
        mine = data !== null;
      }
      if (!cancelled) {
        setDenied(Notification.permission === "denied");
        setEnabled(mine);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    if (next) {
      const result = await subscribeToPush();
      if (result === "ok") {
        setEnabled(true);
        setDenied(false);
        toast.success(t("toasts.enabled"));
      } else if (result === "denied") {
        setDenied(true);
        toast.error(t("permissionDenied"));
      } else if (result === "unsupported") {
        setSupported(false);
        toast.error(t("unsupported"));
      } else {
        toast.error(t("toasts.error"));
      }
    } else {
      // Yıkıcı değil (izin geri alınmıyor, tek tıkla geri açılır) → ConfirmDialog yok.
      const ok = await unsubscribeFromPush();
      if (ok) {
        setEnabled(false);
        toast.success(t("toasts.disabled"));
      } else {
        toast.error(t("toasts.error"));
      }
    }
    setBusy(false);
  }

  const helper = !supported
    ? t("unsupported")
    : denied
      ? t("permissionDenied")
      : enabled
        ? t("enabled")
        : t("desc");

  return (
    <div className="mt-4 flex min-h-11 items-start justify-between gap-4 border-t border-border pt-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Smartphone className="size-4 text-primary" />
          {t("title")}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            denied && supported ? "text-warning" : "text-muted-foreground",
          )}
        >
          {helper}
        </p>
      </div>
      {supported && (
        <span className="flex h-6 shrink-0 items-center gap-2">
          {(busy || !ready) && (
            <Loader2 className="size-4 animate-spin text-primary" />
          )}
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => toggle(checked)}
            disabled={!ready || busy || denied}
            aria-label={enabled ? t("disable") : t("enable")}
          />
        </span>
      )}
    </div>
  );
}

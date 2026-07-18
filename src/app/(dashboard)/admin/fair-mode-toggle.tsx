"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function FairModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const t = useTranslations("admin.fairMode");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !enabled;
    setEnabled(next); // optimistic
    setBusy(true);
    const supabase = createClient();
    // Yalnız value güncellenir (RLS super'a kısıtlı; satır seed edilmiş).
    const { error } = await supabase
      .from("app_settings")
      .update({ value: next ? "true" : "false" })
      .eq("key", "fair_mode_enabled");
    setBusy(false);
    if (error) {
      setEnabled(!next);
      console.error("[fair-mode] güncelleme hatası:", error);
      toast.error(t("toasts.error"));
      return;
    }
    toast.success(next ? t("toasts.on") : t("toasts.off"));
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-muted-foreground" />
          {t("title")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("desc")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t("title")}
        disabled={busy}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
          enabled ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 transform rounded-full bg-primary-foreground shadow-sm transition-transform",
            enabled ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type ClubSetting = {
  id: string;
  name: string;
  requires_advisor_approval: boolean;
};

/**
 * Ayarlar (Dil B): kulüp bazlı "Danışman Onayı" kapısı (requires_advisor_approval)
 * aç/kapat — yalnız okul (RLS). Onay Kuyruğundan buraya taşındı (R4).
 */
export function AdminSettings({ clubs }: { clubs: ClubSetting[] }) {
  const router = useRouter();
  const t = useTranslations("admin.approvals");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleSetting(club: ClubSetting) {
    setBusyId(club.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({ requires_advisor_approval: !club.requires_advisor_approval })
      .eq("id", club.id);
    setBusyId(null);
    if (error) {
      toast.error(t("toasts.settingError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.settingUpdated"));
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          {t("settingsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("settingsDesc")}</p>
      </header>

      {clubs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("noClubs")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {clubs.map((club) => {
            const busy = busyId === club.id;
            const on = club.requires_advisor_approval;
            return (
              <li
                key={club.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {club.name}
                </span>
                <Button
                  onClick={() => toggleSetting(club)}
                  disabled={busy}
                  size="sm"
                  variant="outline"
                  className={
                    on
                      ? "gap-1.5 border-success/40 bg-success/10 text-success hover:bg-success/20"
                      : "gap-1.5"
                  }
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {on ? t("on") : t("off")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

// Profil gizleme (opt-out) — yalnız kamusal-rol kişilere (başkan/danışman/okul)
// gösterilir; sıradan öğrencinin zengin profili zaten yalnız kendine görünür.
// Açık olduğunda: bio/bölüm/sınıf yalnız kişinin kendisine ve okula görünür,
// kişi kişi aramasında çıkmaz. Ad ve rol kulüp/üye listelerinde görünmeye
// DEVAM EDER (net açıklama metni ile — yanlış beklenti oluşmasın).
export function ProfileVisibilityToggle({
  userId,
  initialHidden,
}: {
  userId: string;
  initialHidden: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("profile.visibility");
  const [hidden, setHidden] = useState(initialHidden);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    if (busy) return;
    const prev = hidden;
    setHidden(next); // optimistic
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ hide_profile: next })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setHidden(prev); // geri al
      console.error("[profile-visibility] güncelleme hatası:", error);
      toast.error(t("toastError"));
      return;
    }
    toast.success(next ? t("toastHidden") : t("toastVisible"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <EyeOff className="size-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-11 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("label")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("note")}</p>
          </div>
          <span className="flex h-6 shrink-0 items-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin text-primary" />}
            <Switch
              checked={hidden}
              onCheckedChange={(checked) => toggle(checked)}
              disabled={busy}
              aria-label={t("label")}
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

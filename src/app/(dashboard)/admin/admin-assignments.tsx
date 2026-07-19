"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Option = { id: string; label: string };

// text-base mobil: iOS Safari 16px altındaki form kontrolüne odakta kalıcı
// zoom yapar — küçük görünüm yalnız md+ (ui/input deseni).
const selectClass =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-base text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-card md:text-sm";

export function AdminAssignments({
  clubs,
  users,
  clubAdvisors,
}: {
  clubs: Option[];
  users: Option[];
  /** Kulüp id → mevcut danışman id (server'dan taze; kaydedilen atamanın
   *  reload sonrası GÖRÜNMESİ için read-back — asıl kök sebep buydu). */
  clubAdvisors: Record<string, string | null>;
}) {
  const router = useRouter();
  const t = useTranslations("admin.assignments");

  const [advClub, setAdvClub] = useState("");
  const [advUser, setAdvUser] = useState("");
  const [advBusy, setAdvBusy] = useState(false);

  // id → isim (danışman adını çözmek için).
  const userNameById = useMemo(
    () => new Map(users.map((u) => [u.id, u.label])),
    [users],
  );

  // Kulüp seçilince mevcut danışmanını önseç (dropdown artık boşa düşmez).
  function onClubChange(clubId: string) {
    setAdvClub(clubId);
    setAdvUser(clubId ? (clubAdvisors[clubId] ?? "") : "");
  }

  // Halihazırda danışmanı olan kulüpler (read-back listesi).
  const assigned = useMemo(
    () =>
      clubs
        .filter((c) => clubAdvisors[c.id])
        .map((c) => ({
          club: c.label,
          advisor:
            userNameById.get(clubAdvisors[c.id] as string) ?? t("advisorNone"),
        })),
    [clubs, clubAdvisors, userNameById, t],
  );

  async function assignAdvisor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!advClub) {
      toast.error(t("toasts.clubRequired"));
      return;
    }
    setAdvBusy(true);
    const supabase = createClient();
    const wanted = advUser || null;
    // .select() ŞART: yazılan satırı geri okuruz. RLS USING (is_super_admin)
    // satırı dışlarsa UPDATE 0 satır etkiler ve PostgREST HATA DÖNDÜRMEZ
    // (error=null). Ayrıca dönen advisor_id'yi İSTENEN değerle karşılaştırırız:
    // satır dönse bile alan yazılmadıysa (ör. kolon-grant eksikliği) "başarılı"
    // demeyiz — gerçek kalıcılığı doğrular.
    const { data, error } = await supabase
      .from("clubs")
      .update({ advisor_id: wanted })
      .eq("id", advClub)
      .select("id, advisor_id");
    setAdvBusy(false);
    if (error) {
      console.error("[admin-assignments] atama hatası:", error);
      toast.error(t("toasts.error"));
      return;
    }
    if (!data || data.length === 0 || data[0].advisor_id !== wanted) {
      // 0 satır ya da alan istenen değere yazılmadı: yazma gerçekleşmedi.
      toast.error(t("toasts.notSaved"));
      return;
    }
    toast.success(advUser ? t("toasts.assigned") : t("toasts.removed"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap className="size-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        <CardDescription>
          {t("desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={assignAdvisor} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="adv-club">{t("clubLabel")}</Label>
            <select id="adv-club" className={selectClass} value={advClub} onChange={(e) => onClubChange(e.target.value)} disabled={advBusy}>
              <option value="">{t("clubPlaceholder")}</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adv-user">{t("advisorLabel")}</Label>
            <select id="adv-user" className={selectClass} value={advUser} onChange={(e) => setAdvUser(e.target.value)} disabled={advBusy}>
              <option value="">{t("advisorNone")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>
          {advClub && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {t("currentAdvisor")}:{" "}
              <span className="font-medium text-foreground">
                {clubAdvisors[advClub]
                  ? (userNameById.get(clubAdvisors[advClub] as string) ??
                    t("advisorNone"))
                  : t("advisorNone")}
              </span>
            </p>
          )}
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={advBusy} className="gap-2 font-medium">
              {advBusy && <Loader2 className="size-4 animate-spin" />}
              {t("submit")}
            </Button>
          </div>
        </form>

        {/* Read-back: mevcut atamalar (server'dan taze). Kaydedilen danışman
            burada anında görünür — "atama kayboldu" yanılgısını giderir. */}
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {t("currentTitle")}
          </h3>
          {assigned.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noneAssigned")}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {assigned.map((a) => (
                <li
                  key={a.club}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{a.club}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {a.advisor}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

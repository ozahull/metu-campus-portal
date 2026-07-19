"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GraduationCap, Loader2, UserMinus, UserPlus } from "lucide-react";
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
import { type Option } from "./admin-assignments";

// text-base mobil: iOS Safari 16px altındaki form kontrolüne odakta kalıcı
// zoom yapar — küçük görünüm yalnız md+ (ui/input deseni).
const selectClass =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-base text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-card md:text-sm";

/**
 * HOCA (ADVISOR) rol atama — yalnız SUPER_ADMIN. Rol yazma yolu profiles'ta
 * istemciye KAPALI olduğundan (kolon-grant + RLS + prevent_role_escalation),
 * atama set_user_role SECURITY DEFINER RPC'siyle yapılır (is_super_admin()
 * kapılı; yalnız USER↔ADVISOR). Görsel dil: Dil B (surface-admin).
 */
export function AdminRoles({
  candidates,
  advisors,
}: {
  /** role='USER' — Hoca yapılabilir kullanıcılar. */
  candidates: Option[];
  /** role='ADVISOR' — mevcut hocalar (rol geri alınabilir). */
  advisors: Option[];
}) {
  const router = useRouter();
  const t = useTranslations("admin.roles");

  const [userId, setUserId] = useState("");
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [demoteBusy, setDemoteBusy] = useState<string | null>(null);

  // .select() guard'ın RPC karşılığı: RPC başarısızlıkta RAISE eder (error
  // dolu) ve başarıda İSTENEN rolü döndürür. Dönen değeri istenenle
  // karşılaştırır; eşleşmezse "başarılı" DEMEYİZ — gerçek kalıcılığı doğrular.
  async function setRole(targetId: string, role: "ADVISOR" | "USER") {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_user_role", {
      p_user_id: targetId,
      p_role: role,
    });
    if (error) {
      console.error("[admin-roles] rol atama hatası:", error);
      toast.error(t("toasts.error"));
      return false;
    }
    if (data !== role) {
      toast.error(t("toasts.notSaved"));
      return false;
    }
    return true;
  }

  async function promote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) {
      toast.error(t("toasts.userRequired"));
      return;
    }
    setPromoteBusy(true);
    const ok = await setRole(userId, "ADVISOR");
    setPromoteBusy(false);
    if (ok) {
      toast.success(t("toasts.promoted"));
      setUserId("");
      router.refresh();
    }
  }

  async function demote(targetId: string) {
    setDemoteBusy(targetId);
    const ok = await setRole(targetId, "USER");
    setDemoteBusy(null);
    if (ok) {
      toast.success(t("toasts.demoted"));
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap className="size-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={promote}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="role-user">{t("userLabel")}</Label>
            <select
              id="role-user"
              className={selectClass}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={promoteBusy || candidates.length === 0}
            >
              <option value="">{t("userPlaceholder")}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            disabled={promoteBusy || candidates.length === 0}
            className="h-9 gap-2 font-medium"
          >
            {promoteBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {t("promote")}
          </Button>
        </form>
        {candidates.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noCandidates")}
          </p>
        )}

        {/* Mevcut hocalar (server'dan taze read-back). Atanan hoca burada
            anında görünür — "atama kayboldu" yanılgısını giderir. */}
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {t("currentTitle")}
          </h3>
          {advisors.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noneAssigned")}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {advisors.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{a.label}</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => demote(a.id)}
                    disabled={demoteBusy === a.id}
                    className="shrink-0 gap-1.5"
                  >
                    {demoteBusy === a.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="size-3.5" />
                    )}
                    {t("demote")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

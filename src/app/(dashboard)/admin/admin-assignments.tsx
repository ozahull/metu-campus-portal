"use client";

import { useState } from "react";
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

const selectClass =
  "h-9 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none focus-visible:border-[#841515] [&>option]:bg-zinc-900";

export function AdminAssignments({
  clubs,
  users,
}: {
  clubs: Option[];
  users: Option[];
}) {
  const router = useRouter();
  const t = useTranslations("admin.assignments");

  const [advClub, setAdvClub] = useState("");
  const [advUser, setAdvUser] = useState("");
  const [advBusy, setAdvBusy] = useState(false);

  async function assignAdvisor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!advClub) {
      toast.error(t("toasts.clubRequired"));
      return;
    }
    setAdvBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({ advisor_id: advUser || null })
      .eq("id", advClub);
    setAdvBusy(false);
    if (error) {
      toast.error(t("toasts.error", { message: error.message }));
      return;
    }
    toast.success(advUser ? t("toasts.assigned") : t("toasts.removed"));
    router.refresh();
  }

  return (
    <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <GraduationCap className="size-5 text-[#e7a3a3]" />
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
            <select id="adv-club" className={selectClass} value={advClub} onChange={(e) => setAdvClub(e.target.value)} disabled={advBusy}>
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
          <div className="sm:col-span-2">
            <Button type="submit" disabled={advBusy} className="gap-2 font-medium text-white hover:opacity-90" style={{ backgroundColor: "#841515" }}>
              {advBusy && <Loader2 className="size-4 animate-spin" />}
              {t("submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

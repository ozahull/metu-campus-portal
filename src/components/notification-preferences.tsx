"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BellRing, Check, Loader2, Users2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Scope = "MEMBER_CLUBS" | "ALL" | "NONE";

const OPTIONS: { value: Scope; icon: typeof Users2 }[] = [
  { value: "MEMBER_CLUBS", icon: Users2 },
  { value: "ALL", icon: BellRing },
  { value: "NONE", icon: VolumeX },
];

export function NotificationPreferences({
  initialScope,
}: {
  initialScope: string;
}) {
  const router = useRouter();
  const t = useTranslations("notifications.prefs");
  const [scope, setScope] = useState<Scope>(
    (["MEMBER_CLUBS", "ALL", "NONE"].includes(initialScope)
      ? initialScope
      : "MEMBER_CLUBS") as Scope,
  );
  const [busy, setBusy] = useState<Scope | null>(null);

  async function choose(next: Scope) {
    if (next === scope || busy) return;
    const prev = scope;
    setScope(next);
    setBusy(next);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_notification_preference", {
      p_scope: next,
    });
    setBusy(null);
    if (error) {
      setScope(prev);
      toast.error(t("toasts.error", { message: error.message }));
      return;
    }
    toast.success(t("toasts.saved"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <BellRing className="size-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="radiogroup"
          aria-label={t("title")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {OPTIONS.map(({ value, icon: Icon }) => {
            const active = scope === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy !== null}
                onClick={() => choose(value)}
                className={cn(
                  "relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon
                    className={cn(
                      "size-4",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {busy === value ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    active && <Check className="size-4 text-primary" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {t(value)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`${value}_desc`)}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

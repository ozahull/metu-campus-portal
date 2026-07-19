"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { refreshAfterMutation } from "@/lib/refresh";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

type RSVPButtonProps = {
  eventId: string;
  userId: string;
  isAttending: boolean;
  className?: string;
};

export function RSVPButton({
  eventId,
  userId,
  isAttending,
  className,
}: RSVPButtonProps) {
  const router = useRouter();
  const t = useTranslations("rsvp");
  // Optimistic durum: tıklamada anında değişir; sunucu tazelemesi (refreshRoute)
  // sonrası prop güncellenince senkronlanır. Hata olursa geri alınır.
  const [attending, setAttending] = useState(isAttending);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAttending(isAttending);
  }, [isAttending]);

  async function mutate(next: boolean) {
    setAttending(next); // optimistic
    setLoading(true);
    const supabase = createClient();

    const { error } = next
      ? await supabase
          .from("event_attendees")
          .insert({ event_id: eventId, user_id: userId })
      : await supabase
          .from("event_attendees")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId);

    setLoading(false);

    if (error) {
      setAttending(!next); // geri al
      console.error("[rsvp] işlem hatası:", error);
      toast.error(t(next ? "attendError" : "cancelError"));
      return;
    }

    toast.success(t(next ? "attendSuccess" : "cancelSuccess"));
    // Çift kanallı yerinde tazeleme (canlı QA — bkz. lib/refresh.ts).
    await refreshAfterMutation(router);
  }

  if (attending) {
    // Katılımdan vazgeçiş açık bir karardır — bilet iptali desenindeki gibi
    // ConfirmDialog ile sorulur (yanlışlıkla tek tıkla düşme olmasın);
    // onaylanınca RSVP silinir ve sayaç yerinde tazelenir.
    return (
      <ConfirmDialog
        trigger={
          <Button
            disabled={loading}
            size="sm"
            variant="outline"
            className={cn(
              "gap-1.5 border-success/40 bg-success/15 text-success hover:bg-success/25 hover:text-success",
              className,
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {loading ? t("processing") : t("attending")}
          </Button>
        }
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmBody")}
        confirmLabel={t("cancelConfirmLabel")}
        onConfirm={() => mutate(false)}
      />
    );
  }

  return (
    <Button
      onClick={() => mutate(true)}
      disabled={loading}
      size="sm"
      variant="outline"
      className={cn(
        "gap-1.5 border-primary/50 bg-transparent text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CalendarCheck className="size-4" />
      )}
      {loading ? t("processing") : t("attend")}
    </Button>
  );
}

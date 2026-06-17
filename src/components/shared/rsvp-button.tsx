"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();

    if (isAttending) {
      // Katılımı geri çek
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);

      setLoading(false);

      if (error) {
        toast.error(t("cancelError", { message: error.message }));
        return;
      }

      toast.success(t("cancelSuccess"));
      router.refresh();
      return;
    }

    // Etkinliğe katıl
    const { error } = await supabase
      .from("event_attendees")
      .insert({ event_id: eventId, user_id: userId });

    setLoading(false);

    if (error) {
      toast.error(t("attendError", { message: error.message }));
      return;
    }

    toast.success(t("attendSuccess"));
    router.refresh();
  }

  if (isAttending) {
    return (
      <Button
        onClick={handleClick}
        disabled={loading}
        size="sm"
        variant="outline"
        className={cn(
          "gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200",
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
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size="sm"
      variant="outline"
      className={cn(
        "gap-1.5 border-[#841515]/60 bg-transparent text-zinc-200 hover:border-[#841515] hover:bg-[#841515] hover:text-white",
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

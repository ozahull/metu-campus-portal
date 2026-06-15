"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type JoinButtonProps = {
  clubId: string;
  userId: string;
  isMember: boolean;
};

export function JoinButton({ clubId, userId, isMember }: JoinButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();

    if (isMember) {
      // Kulüpten ayrıl
      const { error } = await supabase
        .from("club_members")
        .delete()
        .eq("club_id", clubId)
        .eq("user_id", userId);

      setLoading(false);

      if (error) {
        toast.error(`Ayrılma başarısız: ${error.message}`);
        return;
      }

      toast.info("Kulüpten ayrıldınız.");
      router.refresh();
      return;
    }

    // Kulübe katıl
    const { error } = await supabase
      .from("club_members")
      .insert({ club_id: clubId, user_id: userId });

    setLoading(false);

    if (error) {
      toast.error(`Katılma başarısız: ${error.message}`);
      return;
    }

    toast.success("Kulübe katıldınız!");
    router.refresh();
  }

  if (isMember) {
    return (
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="outline"
        size="lg"
        className="gap-2 border-white/15 bg-transparent text-zinc-200 hover:border-white/30 hover:bg-white/5 hover:text-white"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        {loading ? "İşleniyor…" : "Kulüpten Ayrıl"}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size="lg"
      className="gap-2 font-medium text-white hover:opacity-90"
      style={{ backgroundColor: "#841515" }}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UserPlus className="size-4" />
      )}
      {loading ? "İşleniyor…" : "Kulübe Katıl"}
    </Button>
  );
}

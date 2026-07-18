"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { VariantProps } from "class-variance-authority";
import { Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";

type ConversationType =
  | "ADMIN_ADVISOR"
  | "ADVISOR_PRESIDENT"
  | "ADMIN_PRESIDENT";

type ComposeButtonProps = {
  type: ConversationType;
  clubId?: string;
  advisorUserId?: string;
  label: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
};

/**
 * Mesaj kanalı giriş noktası (Aşama 4C). open_conversation get-or-create
 * (idempotent): kanal varsa mevcut uuid döner, yoksa açar — dupe oluşmaz.
 * Görünürlük çağıran server component'te bakan-rolünden türetilir; gerçek
 * yetki RPC + RLS'tedir. clubId/advisorUserId gönderilmezse RPC default'u
 * (null) devreye girer.
 */
export function ComposeButton({
  type,
  clubId,
  advisorUserId,
  label,
  variant = "default",
}: ComposeButtonProps) {
  const router = useRouter();
  const t = useTranslations("messages");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("open_conversation", {
      p_type: type,
      p_club_id: clubId,
      p_advisor_user_id: advisorUserId,
    });

    // data null dönmemeli (başkanın ADMIN_PRESIDENT açması engelli — o buton
    // zaten gösterilmiyor); yine de savunmacı davran.
    if (error || !data) {
      setLoading(false);
      if (error) {
        console.error("[messages] open_conversation hatası:", error);
      }
      toast.error(t("compose.error"));
      return;
    }

    // Yönlendirme bitene dek spinner kalsın (çift tıklama koruması).
    router.push(`/messages/${data}`);
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MessagesSquare className="size-4" />
      )}
      {label}
    </Button>
  );
}

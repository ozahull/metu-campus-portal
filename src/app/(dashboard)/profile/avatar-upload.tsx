"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// PRIVATE 'avatars' bucket — public URL YOK, önizleme signed URL ile.
const AVATAR_BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024; // ~2MB

export function AvatarUpload({
  userId,
  initialAvatarUrl,
  initials,
  displayName,
}: {
  userId: string;
  initialAvatarUrl: string | null;
  initials: string;
  displayName: string;
}) {
  const router = useRouter();
  const t = useTranslations("profile");
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("detailsToasts.avatarType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("detailsToasts.avatarTooBig"));
      return;
    }

    setUploading(true);
    const supabase = createClient();

    // Path deseni storage policy tarafından zorunlu: klasör = kullanıcının kendi
    // id'si (avatars_insert → foldername[1] = auth.uid()). Timestamp'li yol
    // cache-busting için gerekli; eski dosyalar en sonda temizlenir (aşağıda).
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (uploadError) {
      setUploading(false);
      // Ham backend mesajını SIZDIRMA — sabit yerelleştirilmiş metin (Aşama 2 dersi).
      console.error("[avatar-upload] yükleme hatası:", uploadError);
      toast.error(t("detailsToasts.avatarError"));
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (updateError) {
      setUploading(false);
      console.error("[avatar-upload] profil güncelleme hatası:", updateError);
      toast.error(t("detailsToasts.avatarError"));
      return;
    }

    // Önizleme için taze signed URL (bucket PRIVATE; public URL YOK).
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, 120);
    setAvatarUrl(signed?.signedUrl ?? null);

    setUploading(false);
    toast.success(t("detailsToasts.avatarUpdated"));
    // Navbar avatarı da tazelensin.
    router.refresh();

    // Orphan temizliği — kasıtlı olarak EN SONDA ve NON-FATAL: yükleme +
    // avatar_url güncellemesi başarıyla bittikten sonra klasördeki eski
    // dosyaları sil. Hata olursa sessizce geç (worst case orphan kalır =
    // eski davranış, regresyon değil).
    try {
      const { data: existing, error: listError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(userId);
      if (listError) {
        console.warn("[avatar-upload] eski avatar listeleme hatası:", listError);
        return;
      }
      const stale = (existing ?? [])
        .map((f) => `${userId}/${f.name}`)
        .filter((p) => p !== path);
      if (stale.length) {
        const { error: removeError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove(stale);
        if (removeError) {
          console.warn("[avatar-upload] eski avatar silme hatası:", removeError);
        }
      }
    } catch (cleanupError) {
      console.warn("[avatar-upload] eski avatar temizliği başarısız:", cleanupError);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 shrink-0 text-base">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className="bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_92%,transparent),color-mix(in_oklab,var(--accent-ember)_78%,transparent))] font-bold text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          {t("detailsCard.avatarLabel")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          className="hidden"
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {avatarUrl ? t("detailsCard.avatarChange") : t("detailsCard.avatarUpload")}
        </Button>
      </div>
    </div>
  );
}

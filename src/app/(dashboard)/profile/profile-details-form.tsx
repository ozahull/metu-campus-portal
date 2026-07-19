"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IdCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { refreshAfterMutation } from "@/lib/refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarUpload } from "./avatar-upload";

const BIO_MAX = 500;

export function ProfileDetailsForm({
  userId,
  initialBio,
  initialDepartment,
  initialClassYear,
  initialAvatarUrl,
  initials,
  displayName,
}: {
  userId: string;
  initialBio: string;
  initialDepartment: string;
  initialClassYear: string;
  initialAvatarUrl: string | null;
  initials: string;
  displayName: string;
}) {
  const router = useRouter();
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");

  const [bio, setBio] = useState(initialBio);
  const [department, setDepartment] = useState(initialDepartment);
  const [classYear, setClassYear] = useState(initialClassYear);
  const [busy, setBusy] = useState(false);

  function orNull(v: string) {
    return v.trim() === "" ? null : v.trim();
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    // role/email/id'ye DOKUNMA — yalnız zengin alanlar. RLS (auth.uid()=id) +
    // UPDATE grant (3A) zaten kendi satırınla sınırlar.
    const { error } = await supabase
      .from("profiles")
      .update({
        bio: orNull(bio),
        department: orNull(department),
        class_year: orNull(classYear),
      })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      // Ham backend mesajını SIZDIRMA — sabit yerelleştirilmiş metin (Aşama 2 dersi).
      console.error("[profile-details] güncelleme hatası:", error);
      toast.error(t("detailsToasts.error"));
      return;
    }
    toast.success(t("detailsToasts.updated"));
    await refreshAfterMutation(router);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <IdCard className="size-4 text-primary" />
          {t("detailsCard.title")}
        </CardTitle>
        <CardDescription>{t("detailsCard.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AvatarUpload
          userId={userId}
          initialAvatarUrl={initialAvatarUrl}
          initials={initials}
          displayName={displayName}
        />

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">{t("detailsCard.bioLabel")}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {bio.length}/{BIO_MAX}
              </span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              rows={4}
              placeholder={t("detailsCard.bioPlaceholder")}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">
                {t("detailsCard.departmentLabel")}
              </Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={t("detailsCard.departmentPlaceholder")}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-year">{t("detailsCard.classYearLabel")}</Label>
              <Input
                id="class-year"
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                placeholder={t("detailsCard.classYearPlaceholder")}
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy} className="gap-2 font-medium">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

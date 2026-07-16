"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, KeyRound, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProfileForm({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string;
}) {
  const router = useRouter();
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");

  const [name, setName] = useState(initialName);
  const [nameBusy, setNameBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim().length < 3) {
      toast.error(t("toasts.nameTooShort"));
      return;
    }
    setNameBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", userId);
    setNameBusy(false);
    if (error) {
      toast.error(t("toasts.nameError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.nameUpdated"));
    router.refresh();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("toasts.passwordShort"));
      return;
    }
    setPwBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPwBusy(false);
    if (error) {
      toast.error(t("toasts.passwordError", { message: error.message }));
      return;
    }
    setPassword("");
    toast.success(t("toasts.passwordUpdated"));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <UserRound className="size-4 text-primary" />
            {t("nameCard.title")}
          </CardTitle>
          <CardDescription>{t("nameCard.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">{t("nameCard.label")}</Label>
              <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} disabled={nameBusy} required />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={nameBusy} className="gap-2 font-medium">
                {nameBusy && <Loader2 className="size-4 animate-spin" />}
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="size-4 text-primary" />
            {t("passwordCard.title")}
          </CardTitle>
          <CardDescription>{t("passwordCard.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("passwordCard.label")}</Label>
              <div className="relative">
                {/*
                  Edge'in native şifre-göster ikonu (::-ms-reveal/::-ms-clear)
                  özel göz butonumuzun üstüne binip tıklamayı yutuyordu; tüm
                  şifre inputları için globals.css'te global gizlendi.
                  data-*ignore: 1Password/LastPass gibi eklentilerin overlay
                  ikonunu bastırır (aynı bölgede çakışan 3. parti kaynak).
                */}
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pwBusy}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? t("passwordCard.hide") : t("passwordCard.show")}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pwBusy} className="gap-2 font-medium">
                {pwBusy && <Loader2 className="size-4 animate-spin" />}
                {t("passwordCard.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/components/shared/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations("auth");

  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reset linki callback üzerinden oturum açtığı için kullanıcı burada
  // kimlik doğrulanmış olmalı. Oturum yoksa link geçersiz/süresi dolmuştur.
  // D21: getUser() reddederse (ağ hatası vb.) sayfa sonsuza dek spinner'da
  // kalıyordu — catch ile geçersiz-oturum ekranına düşer (çıkış yolu linkli).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setValidSession(!!data.user);
      })
      .catch((err) => {
        console.error("[reset-password] oturum kontrolü hatası:", err);
        setValidSession(false);
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("reset.passwordShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(t("reset.updateError"));
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="font-display text-2xl font-bold tracking-tight text-balance">
            {t("reset.title")}
          </CardTitle>
          <CardDescription className="text-pretty">
            {t("reset.subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {checking ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : !validSession ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>{t("reset.invalidTitle")}</AlertTitle>
                <AlertDescription>
                  {t("reset.invalidBody")}
                </AlertDescription>
              </Alert>
              <Link
                href="/forgot-password"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 w-full rounded-full",
                )}
              >
                {t("reset.requestNew")}
              </Link>
            </div>
          ) : done ? (
            <Alert className="border-success/40 bg-success/10 text-success [&>svg]:text-success">
              <CheckCircle2 className="size-4" />
              <AlertTitle>{t("reset.doneTitle")}</AlertTitle>
              <AlertDescription className="text-success/90">
                {t("reset.doneBody")}
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>{t("reset.errorTitle")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t("reset.newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("reset.newPasswordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{t("reset.confirmLabel")}</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("reset.confirmPlaceholder")}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={loading}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    className="h-11 pr-10"
                    required
                  />
                  {/* Aynı showPassword state'i iki alanı birden aç/kapatır (tek göz). */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading || password.length === 0 || confirm.length === 0}
                className="h-11 w-full gap-2 rounded-full text-[0.95rem] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? t("reset.submitting") : t("reset.submit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

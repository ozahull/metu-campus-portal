"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAllowedEmail } from "@/lib/auth";
import { AuthShell } from "@/components/shared/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isAllowedEmail(email)) {
      setError(t("forgot.domainError"));
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        // Callback önce code'u oturuma çevirir, sonra reset sayfasına yönlendirir.
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      },
    );

    setLoading(false);

    if (resetError) {
      setError(t("forgot.sendError"));
      return;
    }

    setSent(true);
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="font-display text-2xl font-bold tracking-tight text-balance">
            {t("forgot.title")}
          </CardTitle>
          <CardDescription className="text-pretty">
            {t("forgot.subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <Alert className="border-success/40 bg-success/10 text-success [&>svg]:text-success">
              <CheckCircle2 className="size-4" />
              <AlertTitle>{t("forgot.sentTitle")}</AlertTitle>
              <AlertDescription className="text-success/90">
                {t("forgot.sentBody")}
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>{t("forgot.errorTitle")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("forgot.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-11"
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading || email.trim().length === 0}
                className="h-11 w-full gap-2 rounded-full text-[0.95rem] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? t("forgot.submitting") : t("forgot.submit")}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:text-accent-ember hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            {t("forgot.backToLogin")}
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

function LoginCard() {
  const router = useRouter();
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const callbackDomainError = searchParams.get("error") === "invalid_domain";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(t("login.invalidCredentials"));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <span className="font-display text-lg font-bold tracking-tight">KKK</span>
        </div>
        <CardTitle className="font-display text-2xl font-bold tracking-tight text-balance">
          {t("login.title")}
        </CardTitle>
        <CardDescription className="text-pretty">
          {t("login.subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {(error || callbackDomainError) && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{t("login.errorTitle")}</AlertTitle>
              <AlertDescription>
                {error ?? t("login.domainError")}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t("login.emailLabel")}</Label>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("login.passwordLabel")}</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary underline-offset-4 hover:text-accent-ember hover:underline"
              >
                {t("login.forgotPassword")}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
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

          <Button
            type="submit"
            size="lg"
            disabled={loading || email.trim().length === 0 || password.length === 0}
            className="h-11 w-full gap-2 rounded-full text-[0.95rem] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:text-accent-ember hover:underline"
          >
            {t("login.registerLink")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense>
        <LoginCard />
      </Suspense>
    </AuthShell>
  );
}

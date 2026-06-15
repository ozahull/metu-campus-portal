"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
      setError("E-posta veya şifre hatalı.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ backgroundColor: "#841515" }}
        >
          <span className="text-lg font-semibold tracking-tight">KKK</span>
        </div>
        <CardTitle className="text-xl font-semibold tracking-tight text-balance">
          Tekrar Hoş Geldiniz
        </CardTitle>
        <CardDescription className="text-pretty">
          ODTÜ KKK Topluluk ve Etkinlik Portalı
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {(error || callbackDomainError) && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Giriş yapılamadı</AlertTitle>
              <AlertDescription>
                {error ??
                  "Sadece ODTÜ uzantılı maillerle giriş yapılabilir"}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ad.soyad@metu.edu.tr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Şifre</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Şifremi Unuttum
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
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
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
            className="w-full gap-2 font-medium text-white hover:opacity-90"
            style={{ backgroundColor: "#841515" }}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Kayıt olun
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

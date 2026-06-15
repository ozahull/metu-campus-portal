"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  const router = useRouter();

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
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setValidSession(!!data.user);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError("Şifre güncellenemedi. Lütfen tekrar deneyin.");
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
      <Card className="w-full max-w-sm border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl font-semibold tracking-tight text-balance">
            Yeni Şifre Belirle
          </CardTitle>
          <CardDescription className="text-pretty">
            Hesabınız için yeni bir şifre oluşturun.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {checking ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : !validSession ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Geçersiz veya süresi dolmuş link</AlertTitle>
              <AlertDescription>
                Lütfen şifre sıfırlama işlemini yeniden başlatın.
              </AlertDescription>
            </Alert>
          ) : done ? (
            <Alert className="border-emerald-500/40 bg-emerald-950/40 text-emerald-200 [&>svg]:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <AlertTitle>Şifreniz güncellendi</AlertTitle>
              <AlertDescription className="text-emerald-300/90">
                Panele yönlendiriliyorsunuz…
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Bir sorun oluştu</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Yeni Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="En az 6 karakter"
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

              <div className="space-y-2">
                <Label htmlFor="confirm">Yeni Şifre (Tekrar)</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Şifreyi tekrar girin"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading || password.length === 0 || confirm.length === 0}
                className="w-full gap-2 font-medium text-white hover:opacity-90"
                style={{ backgroundColor: "#841515" }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Güncelleniyor…" : "Şifreyi Güncelle"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isAllowedEmail(email)) {
      setError("Sadece @metu.edu.tr veya @ncc.metu.edu.tr uzantılı mail kullanılabilir.");
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
      setError("Sıfırlama maili gönderilemedi. Lütfen tekrar deneyin.");
      return;
    }

    setSent(true);
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl font-semibold tracking-tight text-balance">
            Şifrenizi mi unuttunuz?
          </CardTitle>
          <CardDescription className="text-pretty">
            E-posta adresinizi girin, size bir sıfırlama linki gönderelim.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <Alert className="border-emerald-500/40 bg-emerald-950/40 text-emerald-200 [&>svg]:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <AlertTitle>Sıfırlama maili gönderildi</AlertTitle>
              <AlertDescription className="text-emerald-300/90">
                Gelen kutunuzu (ve spam klasörünü) kontrol edip linke tıklayın.
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

              <Button
                type="submit"
                size="lg"
                disabled={loading || email.trim().length === 0}
                className="w-full gap-2 font-medium text-white hover:opacity-90"
                style={{ backgroundColor: "#841515" }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Gönderiliyor…" : "Sıfırlama Linki Gönder"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Girişe dön
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}

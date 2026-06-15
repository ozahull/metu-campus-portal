"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
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

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const emailValid = email.length === 0 || isAllowedEmail(email);
  const formValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isAllowedEmail(email) &&
    password.length >= 6;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isAllowedEmail(email)) {
      setError("Sadece @metu.edu.tr veya @ncc.metu.edu.tr uzantılı mail kullanılabilir.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        // full_name'i metadata'ya da yaz (DB trigger'ı varsa oradan da okunabilir).
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // Oturum hemen açıldıysa (e-posta onayı kapalıysa) profili yaz ve devam et.
    // upsert: profil satırı yoksa oluşturur, varsa günceller.
    if (data.session && data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: normalizedEmail,
          full_name: fullName,
        },
        { onConflict: "id" },
      );

      if (profileError) {
        setLoading(false);
        setError(`Profil kaydedilemedi: ${profileError.message}`);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
      return;
    }

    // E-posta onayı gerekiyorsa: oturum henüz açılmadığından profil yazımı
    // (RLS nedeniyle) burada yapılamaz; full_name metadata'ya yazıldı ve
    // onaydan sonra callback/trigger ile profile aktarılır. Bilgilendirme göster.
    setLoading(false);
    setConfirmSent(true);
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-md border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: "#841515" }}
          >
            <span className="text-lg font-semibold tracking-tight">KKK</span>
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight text-balance">
            Hesap Oluştur
          </CardTitle>
          <CardDescription className="text-pretty">
            ODTÜ KKK Topluluk ve Etkinlik Portalı&apos;na katılın
          </CardDescription>
        </CardHeader>

        <CardContent>
          {confirmSent ? (
            <Alert className="border-emerald-500/40 bg-emerald-950/40 text-emerald-200 [&>svg]:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <AlertTitle>Onay maili gönderildi</AlertTitle>
              <AlertDescription className="text-emerald-300/90">
                E-postanıza gelen onay linkine tıklayarak hesabınızı
                etkinleştirin. (Spam klasörünü de kontrol edin.)
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Kayıt yapılamadı</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Adınız</Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    placeholder="Ayşe"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Soyadınız</Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    placeholder="Yılmaz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">METU E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ad.soyad@metu.edu.tr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-invalid={!emailValid}
                  required
                />
                {!emailValid && (
                  <p className="text-xs text-destructive">
                    Sadece @metu.edu.tr veya @ncc.metu.edu.tr uzantılı mail
                    kullanılabilir.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
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

              <Button
                type="submit"
                size="lg"
                disabled={loading || !formValid}
                className="w-full gap-2 font-medium text-white hover:opacity-90"
                style={{ backgroundColor: "#841515" }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Hesap oluşturuluyor…" : "Hesap Oluştur"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Zaten hesabınız var mı?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Giriş yapın
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}

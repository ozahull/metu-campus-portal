"use client";

import { useState } from "react";
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
  const t = useTranslations("auth");

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
      setError(t("register.domainError"));
      return;
    }
    if (password.length < 6) {
      setError(t("register.passwordShort"));
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

    // Oturum hemen açıldıysa (e-posta onayı kapalıysa) profil satırının
    // full_name'ini güncelle ve devam et. Profil satırı signup'ta HER ZAMAN
    // handle_new_user trigger'ı (SECURITY DEFINER) ile oluşur — bu yüzden
    // INSERT/upsert gerekmez, yalnızca UPDATE.
    // NOT: profiles'a istemciden upsert YASAK — PostgREST upsert'ü
    // "DO UPDATE SET id = excluded.id, ..." üretir, bu da id kolonunda UPDATE
    // yetkisi ister; id'de UPDATE yetkisi bilinçli olarak YOK
    // (20260713190000_tighten_profiles_grants). email'i de yazmıyoruz — trigger
    // zaten metadata'dan yazar ve email kolonu gizlilik (KVKK) gereği kapalı.
    if (data.session && data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", data.user.id);

      if (profileError) {
        setLoading(false);
        setError(t("register.profileError", { message: profileError.message }));
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
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
          >
            <span className="text-lg font-semibold tracking-tight">KKK</span>
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight text-balance">
            {t("register.title")}
          </CardTitle>
          <CardDescription className="text-pretty">
            {t("register.subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {confirmSent ? (
            <Alert className="border-success/40 bg-success/10 text-success [&>svg]:text-success">
              <CheckCircle2 className="size-4" />
              <AlertTitle>{t("register.confirmTitle")}</AlertTitle>
              <AlertDescription className="text-success/90">
                {t("register.confirmBody")}
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>{t("register.errorTitle")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("register.firstNameLabel")}</Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    placeholder={t("register.firstNamePlaceholder")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("register.lastNameLabel")}</Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    placeholder={t("register.lastNamePlaceholder")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("register.emailLabel")}</Label>
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
                    {t("register.domainError")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("register.passwordLabel")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("register.passwordPlaceholder")}
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
                disabled={loading || !formValid}
                className="w-full gap-2 font-medium"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? t("register.submitting") : t("register.submit")}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t("register.haveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("register.loginLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}

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
import {
  deriveNameFromEmail,
  isDerivableEmail,
  nameMatchesEmail,
} from "@/lib/name-from-email";
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
  // Kullanıcı ad alanlarına elle dokundu mu? Dokunmadıysa e-postadan otomatik
  // doldurulur; dokunduysa (Türkçe düzeltme) otomatik doldurma durur.
  const [nameEdited, setNameEdited] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const emailValid = email.length === 0 || isAllowedEmail(email);
  // Doğrulanabilir (ad.soyad) e-postada ad, e-posta ile eşleşmeli. Format dışı
  // e-postada (nokta yok) doğrulama uygulanmaz (serbest).
  const nameMatches = !isDerivableEmail(email) || nameMatchesEmail(fullName, email);
  const showNameMismatch =
    isAllowedEmail(email) &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !nameMatches;
  const formValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isAllowedEmail(email) &&
    password.length >= 6 &&
    nameMatches;

  // E-posta değişince ad alanlarını (kullanıcı henüz dokunmadıysa) otomatik doldur.
  function onEmailChange(value: string) {
    setEmail(value);
    if (!nameEdited) {
      const derived = deriveNameFromEmail(value);
      if (derived) {
        setFirstName(derived.first);
        setLastName(derived.last);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isAllowedEmail(email)) {
      setError(t("register.domainError"));
      return;
    }
    // Sunucu (handle_new_user) da doğrular; burada anlık geri bildirim için.
    if (isDerivableEmail(email) && !nameMatchesEmail(fullName, email)) {
      setError(t("register.nameMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("register.passwordShort"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
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
      <Card className="w-full max-w-md shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
        <CardHeader className="space-y-3 text-center">
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
          >
            <span className="font-display text-lg font-bold tracking-tight">KKK</span>
          </div>
          <CardTitle className="font-display text-2xl font-bold tracking-tight text-balance">
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
                    onChange={(e) => {
                      setNameEdited(true);
                      setFirstName(e.target.value);
                    }}
                    disabled={loading}
                    aria-invalid={showNameMismatch}
                    className="h-11"
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
                    onChange={(e) => {
                      setNameEdited(true);
                      setLastName(e.target.value);
                    }}
                    disabled={loading}
                    aria-invalid={showNameMismatch}
                    className="h-11"
                    required
                  />
                </div>
              </div>
              {showNameMismatch && (
                <p className="-mt-2 text-xs text-destructive">
                  {t("register.nameMismatch")}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("register.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ad.soyad@metu.edu.tr"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={loading}
                  aria-invalid={!emailValid}
                  className="h-11"
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
                disabled={loading || !formValid}
                className="h-11 w-full gap-2 rounded-full text-[0.95rem] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
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
              className="font-medium text-primary underline-offset-4 hover:text-accent-ember hover:underline"
            >
              {t("register.loginLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}

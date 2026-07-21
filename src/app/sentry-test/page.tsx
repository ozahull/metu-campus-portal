// GEÇİCİ — Sentry doğrulama sayfası. Sunucu + tarayıcı hatalarını elle tetikler.
// Doğrulama sonrası bu klasörü (src/app/sentry-test) ve src/app/api/sentry-test'i SİL.
import type { Metadata } from "next";
import { SentryTestButtons } from "./sentry-test-buttons";

export const metadata: Metadata = {
  title: "Sentry Doğrulama (geçici)",
};

export default function SentryTestPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
        <strong>Geçici doğrulama sayfası.</strong> Sentry kurulumunu test eder.
        Doğrulama bittiğinde <code>src/app/sentry-test</code> ve{" "}
        <code>src/app/api/sentry-test</code> silinir.
      </div>
      <SentryTestButtons />
    </main>
  );
}

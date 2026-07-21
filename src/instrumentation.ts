// Next 16 sunucu instrumentation'ı — Sentry'yi runtime'a göre başlatır ve
// sunucu tarafı (Server Component / Route Handler / Server Action) hatalarını
// yakalar. onRequestError, App Router'daki yakalanmayan sunucu hatalarını
// Sentry'ye iletir (kaynak haritalarıyla okunur stack trace).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, RotateCw, Search, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TicketCard, type TicketCardData } from "./ticket-card";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tickets");
  return { title: t("title") };
}

// VERİ KATMANI KARARI — doğrudan sorgu, RPC YOK (gerekçe):
// tickets_select RLS'i `user_id = auth.uid()` ile kendi biletlerini zaten
// veriyor; events embed'i de RLS'ten geçer çünkü bilet YALNIZ APPROVED
// etkinlikte kesilebilir (ticket_issue) ve APPROVED durumdan çıkış yolu yok
// (event_submit Y7 ön-koşulu APPROVED'ı yeniden akışa sokmayı reddeder).
// Öğrencinin events SELECT'i APPROVED satırları kapsar → join daima görünür.
// Tek sorgu: bilet + etkinlik + kulüp adı (N+1 yok, FK embed).
type TicketRow = {
  id: string;
  token: string;
  status: string;
  events:
    | {
        id: string;
        title: string;
        event_date: string;
        location: string | null;
        clubs: { name: string } | { name: string }[] | null;
      }
    | {
        id: string;
        title: string;
        event_date: string;
        location: string | null;
        clubs: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function TicketsPage() {
  const t = await getTranslations("tickets");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, token, status, events(id, title, event_date, location, clubs(name))",
    )
    .eq("user_id", user.id);

  // Hata boş-durumla KARIŞMAZ (dashboard D22 emsali): "yüklenemedi + tekrar
  // dene" ayrı gösterilir; boş liste ancak hatasız sorguda boş durumdur.
  if (error) {
    console.error("[tickets] bilet listesi hatası:", error);
    return (
      <PageShell>
        <TicketsHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState
          icon={AlertTriangle}
          title={t("loadErrorTitle")}
          description={t("loadErrorBody")}
          action={
            <Link
              href="/tickets"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
              )}
            >
              <RotateCw className="size-4" />
              {t("retry")}
            </Link>
          }
        />
      </PageShell>
    );
  }

  // SINIFLANDIRMA — iki bağımsız boyut (status × zaman), SUNUCUDA BİR KEZ:
  //   AKTİF  = status APPROVED VE etkinlik başlamamış
  //   GEÇMİŞ = CHECKED_IN (girilmiş bilet, etkinlik başlamamış olsa bile) VEYA
  //            etkinlik zamanı geçmiş
  // Anlar (timestamptz) TZ'den bağımsız epoch olarak karşılaştırılır; sonuç
  // istemciye HAZIR boolean/bölüm olarak iner — istemci yeniden hesaplamaz
  // (hydration determinizmi, #418 dersi). GÖSTERİM formatDateTime ile
  // (Europe/Istanbul) TicketCard içinde yapılır.
  const now = Date.now();
  const cards: (TicketCardData & { eventDateMs: number })[] = (
    (data ?? []) as unknown as TicketRow[]
  )
    .map((row) => {
      const ev = unwrap(row.events);
      if (!ev) return null; // embed boş (beklenmez) — kart üretilmez
      const eventDateMs = new Date(ev.event_date).getTime();
      const checkedIn = row.status === "CHECKED_IN";
      const started = eventDateMs <= now;
      return {
        id: row.id,
        token: row.token,
        eventId: ev.id,
        eventTitle: ev.title,
        eventDateISO: ev.event_date,
        location: ev.location,
        clubName: unwrap(ev.clubs)?.name ?? null,
        checkedIn,
        // AKTİF: onaylı + başlamamış. Diğer her şey geçmiş bölümüne.
        active: row.status === "APPROVED" && !started,
        // Damga: girildi > geçti (girilmiş bilette "geçti" gösterilmez).
        expired: !checkedIn && started,
        eventDateMs,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Sıralama (deterministik — id ikincil): aktif en yakın önce, geçmiş en yeni önce.
  const active = cards
    .filter((c) => c.active)
    .sort(
      (a, b) => a.eventDateMs - b.eventDateMs || a.id.localeCompare(b.id),
    );
  const past = cards
    .filter((c) => !c.active)
    .sort(
      (a, b) => b.eventDateMs - a.eventDateMs || a.id.localeCompare(b.id),
    );

  return (
    <PageShell>
      <TicketsHeader title={t("title")} subtitle={t("subtitle")} />

      {cards.length === 0 ? (
        // Hiç bilet yok: yönlendiren boş durum.
        <EmptyState
          icon={Ticket}
          title={t("emptyAllTitle")}
          description={t("emptyAllBody")}
          action={
            <Link
              href="/events"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              <Search className="size-4" />
              {t("browseEvents")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 font-display text-lg font-bold tracking-tight">
              {t("activeTitle")}
            </h2>
            {active.length === 0 ? (
              // Aktif yok ama geçmiş var: bölüm kendi boş metnini gösterir.
              <p className="rounded-xl border border-dashed border-border bg-muted/40 px-5 py-8 text-center text-sm text-muted-foreground">
                {t("emptyActive")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {active.map((c) => (
                  <TicketCard key={c.id} ticket={c} locale={locale} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-muted-foreground">
                {t("pastTitle")}
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {past.map((c) => (
                  <TicketCard key={c.id} ticket={c} locale={locale} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}

function TicketsHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8 flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Ticket className="size-5" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </header>
  );
}

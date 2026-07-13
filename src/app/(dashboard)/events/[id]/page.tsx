import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarClock, MapPin, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { AddToCalendar } from "./add-to-calendar";
import { TicketFlow, type MyTicket } from "./ticket-flow";
import { formatPrice } from "@/lib/ticket-status";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("title")
    .eq("id", id)
    .maybeSingle<{ title: string }>();
  if (data?.title) return { title: data.title };
  const t = await getTranslations("events");
  return { title: t("title") };
}

type EventClub = {
  id: string;
  name: string;
  iban: string | null;
  ticket_enabled: boolean;
};

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  status: string;
  club_id: string;
  ticket_price: number | null;
  ticket_deadline: string | null;
  clubs: EventClub | EventClub[] | null;
  event_attendees: { user_id: string }[] | null;
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("events");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, location, status, club_id, ticket_price, ticket_deadline, clubs(id, name, iban, ticket_enabled), event_attendees(user_id)",
    )
    .eq("id", id)
    .maybeSingle<EventDetail>();

  if (error) {
    console.error("[EventDetail] Etkinlik çekme hatası:", error);
  }

  // Öğrenci yalnızca onaylı etkinliği görebilir (RLS de korur).
  if (!data || data.status !== "APPROVED") {
    redirect("/events");
  }

  const club = Array.isArray(data.clubs) ? data.clubs[0] : data.clubs;
  const attendees = data.event_attendees ?? [];
  const isAttending = attendees.some((a) => a.user_id === user.id);

  // Ücret rozeti için: fiyat tanımlı ve > 0 ise ücretli.
  const priceNum = data.ticket_price !== null ? Number(data.ticket_price) : null;
  const isPaid = priceNum !== null && priceNum > 0;

  // Bilet akışı yalnızca kulüp bilet sistemini açtıysa VE etkinlik ücretliyse
  // (ticket_price tanımlı ve > 0) gösterilir. Ücretsiz etkinlikte klasik RSVP
  // korunur — aksi halde ücretsizde gereksiz dekont akışı tetikleniyor.
  const ticketingOn = Boolean(club?.ticket_enabled) && isPaid;

  // Kullanıcının bu etkinlik için biletini çek (varsa).
  let myTicket: MyTicket | null = null;
  if (ticketingOn) {
    const { data: t } = await supabase
      .from("tickets")
      .select("id, token, status, receipt_url")
      .eq("event_id", data.id)
      .eq("user_id", user.id)
      .maybeSingle<MyTicket>();
    myTicket = t ?? null;
  }

  return (
    <main className="relative">
      <div className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="pt-6">
          <Link
            href="/events"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Link>
        </div>

        <header className="mt-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {club && (
              <Link
                href={`/clubs/${club.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Users className="size-3.5" />
                {club.name}
              </Link>
            )}
            {isPaid ? (
              <Badge variant="primary">
                <Ticket className="size-3" />
                {t("priceBadge", {
                  price: formatPrice(priceNum, locale) ?? t("free"),
                })}
              </Badge>
            ) : (
              <Badge>
                <Ticket className="size-3" />
                {t("free")}
              </Badge>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {data.title}
          </h1>
        </header>

        {/* Bilgi şeridi: tarih · konum · katılımcı */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <CalendarClock className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              {formatDateTime(data.event_date, locale, "long")}
            </span>
          </div>
          {data.location && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{data.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <Users className="size-4 shrink-0 text-primary" />
            {t("attendingCount", { count: attendees.length })}
          </div>
        </div>

        {/* Katılım / bilet CTA'sı — belirgin */}
        {ticketingOn ? (
          <div className="mt-6">
            <TicketFlow
              eventId={data.id}
              userId={user.id}
              clubIban={club?.iban ?? null}
              price={data.ticket_price}
              closesAtISO={data.ticket_deadline ?? data.event_date}
              ticket={myTicket}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">
              {t("attendingCount", { count: attendees.length })}
            </span>
            <RSVPButton
              eventId={data.id}
              userId={user.id}
              isAttending={isAttending}
            />
          </div>
        )}

        {data.description?.trim() && (
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("about")}
            </h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">
              {data.description}
            </p>
          </section>
        )}

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {t("addToCalendar")}
          </p>
          <AddToCalendar
            title={data.title}
            description={data.description}
            location={data.location}
            startISO={data.event_date}
          />
        </div>
      </div>
    </main>
  );
}

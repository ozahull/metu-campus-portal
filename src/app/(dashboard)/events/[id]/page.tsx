import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, Flame, MapPin, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { AddToCalendar } from "./add-to-calendar";
import { TicketFlow, type MyTicket } from "./ticket-flow";
import { formatPrice } from "@/lib/ticket-status";

export const dynamic = "force-dynamic";

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

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "full",
  timeStyle: "short",
});

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    <main className="relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/events"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 gap-1.5 text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <ArrowLeft className="size-4" />
          Etkinlikler
        </Link>

        <header className="mt-6 mb-8">
          {club && (
            <Link
              href={`/clubs/${club.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#841515]/30 bg-[#841515]/10 px-3 py-1 text-xs font-medium text-[#e7a3a3] transition-colors hover:bg-[#841515]/20"
            >
              <Users className="size-3.5" />
              {club.name}
            </Link>
          )}
          <h1
            className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
            style={{ textShadow: "0 0 40px rgba(132,21,21,0.45)" }}
          >
            {data.title}
          </h1>

          {/* Ücret rozeti — açıklamadan ayrı, belirgin */}
          <div className="mt-4">
            {isPaid ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#841515]/50 bg-[#841515]/15 px-3.5 py-1.5 text-sm font-semibold text-white">
                <Ticket className="size-4 text-[#e7a3a3]" />
                Ücret: {formatPrice(priceNum)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-zinc-300">
                <Ticket className="size-4 text-zinc-500" />
                Ücretsiz
              </span>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200">
            <CalendarClock className="size-4 shrink-0 text-[#e7a3a3]" />
            {dateFormatter.format(new Date(data.event_date))}
          </div>
          {data.location && (
            <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200">
              <MapPin className="size-4 shrink-0 text-[#e7a3a3]" />
              {data.location}
            </div>
          )}
        </div>

        {data.description?.trim() && (
          <Card className="mt-6 border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">
                Hakkında
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed text-zinc-300 whitespace-pre-line">
                {data.description}
              </p>
            </CardContent>
          </Card>
        )}

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
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-white/5 bg-zinc-900/50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300">
              <Flame className="size-4 text-orange-400" />
              {attendees.length} kişi katılıyor
            </span>
            <RSVPButton eventId={data.id} userId={user.id} isAttending={isAttending} />
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-zinc-400">Takvime ekle</p>
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

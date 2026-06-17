import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, QrCode, Settings, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClubInfoForm, type ClubInfo } from "./club-info-form";
import { ManageEvents, type ManageEvent } from "./manage-events";
import { ManageMembers, type RosterMember } from "./manage-members";
import { ManageTickets, type EventTicketGroup } from "./manage-tickets";

export const dynamic = "force-dynamic";

type RosterRow = {
  user_id: string;
  role: string;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
};

type TicketRow = {
  id: string;
  status: string;
  receipt_url: string | null;
  user_id: string;
  event_id: string;
  created_at: string;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
  events:
    | { title: string; ticket_capacity: number | null }
    | { title: string; ticket_capacity: number | null }[]
    | null;
};

const RECEIPT_BUCKET = "receipts";

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ClubManagePage({
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

  const { data: club } = await supabase
    .from("clubs")
    .select(
      "id, name, category, description, vision, logo_url, cover_url, contact_email, contact_phone, whatsapp_url, instagram_url, advisor_id",
    )
    .eq("id", id)
    .maybeSingle<ClubInfo & { advisor_id: string | null }>();

  if (!club) redirect("/dashboard");

  // Erişim: SUPER_ADMIN veya bu kulübün danışmanı veya başkanı (ADMIN).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperAdmin =
    profile?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";

  const isClubAdvisor = club.advisor_id === user.id;

  const { data: myMembership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isClubAdmin = myMembership?.role?.toString().toUpperCase() === "ADMIN";

  if (!isSuperAdmin && !isClubAdvisor && !isClubAdmin) {
    redirect(`/clubs/${id}`);
  }

  // Başkan (ADMIN) atama/geri alma yalnızca okul ve danışmana açıktır.
  const canAssignAdmin = isSuperAdmin || isClubAdvisor;

  // Etkinlikler (tüm statüler — yöneticiler için).
  const { data: eventsRaw } = await supabase
    .from("events")
    .select("id, title, description, event_date, location, status, review_note")
    .eq("club_id", id)
    .order("event_date", { ascending: true });
  const events = (eventsRaw ?? []) as ManageEvent[];

  // Üye listesi (isim + rol).
  const { data: rosterRaw } = await supabase
    .from("club_members")
    .select("user_id, role, profile:user_id(full_name)")
    .eq("club_id", id)
    .order("created_at", { ascending: true });

  const members: RosterMember[] = ((rosterRaw ?? []) as unknown as RosterRow[]).map(
    (r) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return {
        user_id: r.user_id,
        role: r.role,
        full_name: p?.full_name ?? null,
      };
    },
  );

  // Biletler: bu kulübün etkinliklerine ait biletler (events!inner ile kulübe filtre).
  const { data: ticketRaw } = await supabase
    .from("tickets")
    .select(
      "id, status, receipt_url, user_id, event_id, created_at, profile:user_id(full_name), events!inner(title, club_id, ticket_capacity)",
    )
    .eq("events.club_id", id)
    .order("created_at", { ascending: true });

  const ticketRows = (ticketRaw ?? []) as unknown as TicketRow[];

  // Etkinlik bazlı grupla: bekleyen (SUBMITTED) + onaylı/giriş sayacı.
  const groupMap = new Map<string, EventTicketGroup>();
  for (const t of ticketRows) {
    const ev = unwrap(t.events);
    if (!ev) continue;
    let g = groupMap.get(t.event_id);
    if (!g) {
      g = {
        eventId: t.event_id,
        title: ev.title,
        capacity: ev.ticket_capacity,
        approvedCount: 0,
        checkedInCount: 0,
        pending: [],
      };
      groupMap.set(t.event_id, g);
    }
    if (t.status === "APPROVED") g.approvedCount += 1;
    else if (t.status === "CHECKED_IN") {
      g.approvedCount += 1;
      g.checkedInCount += 1;
    } else if (t.status === "SUBMITTED") {
      // Dekontu kısa ömürlü signed URL ile göster (public URL ASLA).
      let receiptSignedUrl: string | null = null;
      if (t.receipt_url) {
        const { data: signed } = await supabase.storage
          .from(RECEIPT_BUCKET)
          .createSignedUrl(t.receipt_url, 120);
        receiptSignedUrl = signed?.signedUrl ?? null;
      }
      g.pending.push({
        id: t.id,
        full_name: unwrap(t.profile)?.full_name ?? null,
        receiptSignedUrl,
      });
    }
  }
  const ticketGroups = Array.from(groupMap.values());
  const hasTicketing = ticketGroups.length > 0;

  return (
    <main className="dark relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/clubs/${id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 gap-1.5 text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <ArrowLeft className="size-4" />
          Kulübe Dön
        </Link>

        <header className="mt-6 mb-8 flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ backgroundColor: "#841515" }}
          >
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {club.name} · Yönetim
            </h1>
            <p className="text-sm text-zinc-400">
              {isSuperAdmin
                ? "Süper yönetici"
                : isClubAdvisor
                  ? "Danışman"
                  : "Kulüp başkanı"}{" "}
              erişimi
            </p>
          </div>
        </header>

        <div className="space-y-6">
          {/* Kulüp bilgisi */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">
                Kulüp Bilgileri
              </CardTitle>
              <CardDescription>
                Topluluğun genel bilgilerini ve iletişim kanallarını düzenleyin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClubInfoForm club={club} />
            </CardContent>
          </Card>

          {/* Etkinlikler */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <CalendarDays className="size-4 text-[#e7a3a3]" />
                Etkinlikler
              </CardTitle>
              <CardDescription>
                Kulübünüzün etkinliklerini oluşturun, düzenleyin veya silin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageEvents clubId={id} events={events} canAdvisorDecide={canAssignAdmin} />
            </CardContent>
          </Card>

          {/* Biletler / Dekont onayı */}
          {hasTicketing && (
            <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Ticket className="size-4 text-[#e7a3a3]" />
                    Biletler
                  </CardTitle>
                  <CardDescription>
                    Dekontları inceleyip onaylayın veya reddedin.
                  </CardDescription>
                </div>
                <Link
                  href={`/clubs/${id}/checkin`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5 border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <QrCode className="size-4" />
                  Kapı Kontrol
                </Link>
              </CardHeader>
              <CardContent>
                <ManageTickets groups={ticketGroups} />
              </CardContent>
            </Card>
          )}

          {/* Üyeler */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <Users className="size-4 text-[#e7a3a3]" />
                Üyeler ({members.length})
              </CardTitle>
              <CardDescription>
                Üyeleri yönetin; yönetici atayın veya kulüpten çıkarın.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageMembers clubId={id} members={members} canAssignAdmin={canAssignAdmin} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

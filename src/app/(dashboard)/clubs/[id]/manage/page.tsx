import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  CalendarDays,
  Info,
  Megaphone,
  QrCode,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { unwrapEmbed } from "@/lib/embed";
import { roleLabel } from "@/lib/role-label";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ClubInfoForm, type ClubInfo } from "./club-info-form";
import { ClubAnnounceForm } from "./club-announce-form";
import { ManageEvents, type ManageEvent } from "./manage-events";
import type { EventDocument } from "./event-documents";
import { ManageMembers, type RosterMember } from "./manage-members";
import { ManageTickets, type EventTicketGroup } from "./manage-tickets";

export const dynamic = "force-dynamic";

type RosterRow = {
  user_id: string;
  role: string;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
};

type TicketRow = {
  status: string;
  event_id: string;
  events:
    | { title: string; ticket_capacity: number | null }
    | { title: string; ticket_capacity: number | null }[]
    | null;
};

const DOC_BUCKET = "event-docs";

type EventDocumentRow = {
  id: string;
  event_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  note: string | null;
};

export default async function ClubManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("manage.shell");
  const tRoleLabels = await getTranslations("roleLabels");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select(
      "id, name, category, description, vision, logo_url, cover_url, contact_email, contact_phone, whatsapp_url, instagram_url, ticket_enabled, advisor_id",
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
    .select(
      "id, title, description, event_date, location, status, review_note, ticket_capacity, ticket_deadline",
    )
    .eq("club_id", id)
    .order("event_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);
  const events = (eventsRaw ?? []) as ManageEvent[];

  // Belge ekleri: bu kulübün etkinliklerine ait event_documents. Görüntüleme
  // kısa ömürlü signed URL ile (public URL ASLA). Yükleme başkan/okul'a açık.
  const canUploadDocs = isSuperAdmin || isClubAdmin;
  const documentsByEvent: Record<string, EventDocument[]> = {};
  const eventIds = events.map((e) => e.id);
  if (eventIds.length > 0) {
    const { data: docRaw } = await supabase
      .from("event_documents")
      .select("id, event_id, uploaded_by, file_url, file_name, note")
      .in("event_id", eventIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    // Signed URL üretimi PARALEL (N+1 sıralı await yerine — clubs/new deseni).
    const signedDocs = await Promise.all(
      ((docRaw ?? []) as EventDocumentRow[]).map(async (d) => {
        let signedUrl: string | null = null;
        if (d.file_url) {
          const { data: signed } = await supabase.storage
            .from(DOC_BUCKET)
            .createSignedUrl(d.file_url, 120);
          signedUrl = signed?.signedUrl ?? null;
        }
        return { d, signedUrl };
      }),
    );
    for (const { d, signedUrl } of signedDocs) {
      (documentsByEvent[d.event_id] ??= []).push({
        id: d.id,
        file_name: d.file_name,
        note: d.note,
        signedUrl,
        canDelete: d.uploaded_by === user.id,
      });
    }
  }

  // Üye listesi (isim + rol).
  const { data: rosterRaw } = await supabase
    .from("club_members")
    .select("user_id, role, profile:user_id(full_name)")
    .eq("club_id", id)
    .order("created_at", { ascending: true })
    // club_members'ta "id" kolonu YOK (PK club_id+user_id) — ikincil sıralama user_id.
    .order("user_id", { ascending: true })
    .limit(500);

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

  // Biletler: bu kulübün etkinliklerine ait katılım biletleri (salt-okunur
  // özet — ödeme/dekont yok). events!inner ile kulübe filtre.
  const { data: ticketRaw } = await supabase
    .from("tickets")
    .select("status, event_id, events!inner(title, club_id, ticket_capacity)")
    .eq("events.club_id", id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1000);

  const ticketRows = (ticketRaw ?? []) as unknown as TicketRow[];

  // Etkinlik bazlı grupla: verilen bilet (APPROVED+CHECKED_IN) + giriş sayacı.
  const groupMap = new Map<string, EventTicketGroup>();
  for (const t of ticketRows) {
    const ev = unwrapEmbed(t.events);
    if (!ev) continue;
    let g = groupMap.get(t.event_id);
    if (!g) {
      g = {
        eventId: t.event_id,
        title: ev.title,
        capacity: ev.ticket_capacity,
        issuedCount: 0,
        checkedInCount: 0,
      };
      groupMap.set(t.event_id, g);
    }
    if (t.status === "APPROVED" || t.status === "CHECKED_IN") {
      g.issuedCount += 1;
      if (t.status === "CHECKED_IN") g.checkedInCount += 1;
    }
  }
  const ticketGroups = Array.from(groupMap.values());
  // OPT-IN: check-in sekmesi/linki kulüp katılım biletini açtıysa görünür
  // (eski "dekont var mı" koşulundan bağımsız — giriş noktası kaybolmasın).
  const hasTicketing = club.ticket_enabled;

  return (
    // Dil B "Sessiz Verimlilik": yönetim yüzeyi surface-admin ile beyaz/nötr
    // remap'e döner (navbar Dil A'da kalır). bkz. shared/admin-surface.tsx.
    <main className="surface-admin relative min-h-svh bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="pt-6">
          <Link
            href={`/clubs/${id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </Link>
        </div>

        <header className="mt-4 mb-8 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("title", { name: club.name })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("access", {
                role: roleLabel(
                  isSuperAdmin
                    ? "SUPER_ADMIN"
                    : isClubAdvisor
                      ? "ADVISOR"
                      : "PRESIDENT",
                  tRoleLabels,
                ),
              })}
            </p>
          </div>
        </header>

        <Tabs defaultValue="info">
          <TabsList>
            <TabsTab value="info">
              <Info className="size-4" />
              {t("tabInfo")}
            </TabsTab>
            <TabsTab value="events">
              <CalendarDays className="size-4" />
              {t("tabEvents")}
            </TabsTab>
            {hasTicketing && (
              <TabsTab value="tickets">
                <Ticket className="size-4" />
                {t("tabTickets")}
              </TabsTab>
            )}
            <TabsTab value="members">
              <Users className="size-4" />
              {t("tabMembers")}
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {members.length}
              </span>
            </TabsTab>
            <TabsTab value="announce">
              <Megaphone className="size-4" />
              {t("tabAnnounce")}
            </TabsTab>
          </TabsList>

          <TabsPanel value="info" className="space-y-4">
            <PanelHead title={t("infoTitle")} desc={t("infoDesc")} />
            <ClubInfoForm club={club} />
          </TabsPanel>

          <TabsPanel value="events" className="space-y-4">
            <PanelHead title={t("eventsTitle")} desc={t("eventsDesc")} />
            <ManageEvents
              clubId={id}
              events={events}
              canAdvisorDecide={canAssignAdmin}
              ticketEnabled={club.ticket_enabled}
              userId={user.id}
              canUploadDocs={canUploadDocs}
              documentsByEvent={documentsByEvent}
            />
          </TabsPanel>

          {hasTicketing && (
            <TabsPanel value="tickets" className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <PanelHead title={t("ticketsTitle")} desc={t("ticketsDesc")} />
                <Link
                  href={`/clubs/${id}/checkin`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5",
                  )}
                >
                  <QrCode className="size-4" />
                  {t("checkin")}
                </Link>
              </div>
              <ManageTickets groups={ticketGroups} />
            </TabsPanel>
          )}

          <TabsPanel value="members" className="space-y-4">
            <PanelHead
              title={t("membersTitle", { count: members.length })}
              desc={t("membersDesc")}
            />
            <ManageMembers
              clubId={id}
              members={members}
              canAssignAdmin={canAssignAdmin}
            />
          </TabsPanel>

          <TabsPanel value="announce" className="space-y-4">
            <PanelHead title={t("announceTitle")} desc={t("announceDesc")} />
            <ClubAnnounceForm clubId={id} />
          </TabsPanel>
        </Tabs>
      </div>
    </main>
  );
}

function PanelHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

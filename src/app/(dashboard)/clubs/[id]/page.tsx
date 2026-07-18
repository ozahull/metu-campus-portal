import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { safeExternalHref } from "@/lib/url";
import {
  ArrowLeft,
  AtSign,
  CalendarDays,
  Crown,
  ExternalLink,
  GraduationCap,
  Images,
  Info,
  Mail,
  MessageCircle,
  Phone,
  SearchX,
  Settings,
  Target,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/category";
import { fetchAttendanceCounts } from "@/lib/attendance";
import { roleLabel } from "@/lib/role-label";
import { normalizeMultiline } from "@/lib/text";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { EventCard, type EventCardData } from "@/components/shared/event-card";
import { ComposeButton } from "@/components/messaging/compose-button";
import { cn } from "@/lib/utils";
import { BadgeIconRow } from "@/components/badges";
import { JoinButton } from "./join-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", id)
    .maybeSingle<{ name: string }>();
  if (data?.name) return { title: data.name };
  const t = await getTranslations("clubs");
  return { title: t("notFoundTitle") };
}

type Club = {
  id: string;
  name: string;
  description: string | null;
  advisor_id: string | null;
  vision: string | null;
  logo_url: string | null;
  cover_url: string | null;
  category: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_url: string | null;
  instagram_url: string | null;
};

type MemberProfile = {
  id: string;
  full_name: string | null;
};

type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  event_attendees: { user_id: string }[] | null;
};

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("clubs");
  const tMessages = await getTranslations("messages");
  const tCategories = await getTranslations("categories");
  const tRoleLabels = await getTranslations("roleLabels");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: club, error } = await supabase
    .from("clubs")
    .select(
      "id, name, description, advisor_id, vision, logo_url, cover_url, category, contact_email, contact_phone, whatsapp_url, instagram_url",
    )
    .eq("id", id)
    .maybeSingle<Club>();

  if (error) {
    console.error("[ClubDetail] Kulüp çekme hatası:", error);
  }

  // Kulüp üyelerini ve profillerini (isim) çek. role, başkanı (ADMIN)
  // ayırt etmek için — club_members SELECT'i herkese açık, profiles tarafında
  // yalnız broad-grant alanları (id, full_name) embed'lenir.
  const { data: membersRaw, error: membersError } = await supabase
    .from("club_members")
    .select("role, user_id(id, full_name)")
    .eq("club_id", id);

  if (membersError) {
    console.error("[ClubDetail] Üyeler çekme hatası:", membersError);
  }

  // Embed sonucunu düz bir profil listesine normalize et.
  type MemberRow = {
    role: string;
    user_id: MemberProfile | MemberProfile[] | null;
  };
  const memberRows = (membersRaw ?? []) as MemberRow[];
  const unwrapMember = (row: MemberRow) =>
    Array.isArray(row.user_id) ? row.user_id[0] : row.user_id;

  const members: MemberProfile[] = memberRows
    .map(unwrapMember)
    .filter((p): p is MemberProfile => Boolean(p));

  // Üye sekmesi için rol bilgisiyle liste (D24): başkan satırı diğer
  // ekranlarla aynı "Başkan" etiketini taşır — etiketsiz kalmaz.
  const memberList = memberRows
    .map((row) => {
      const p = unwrapMember(row);
      return p ? { ...p, isPresident: row.role?.toString().trim().toUpperCase() === "ADMIN" } : null;
    })
    .filter((p): p is MemberProfile & { isPresident: boolean } => Boolean(p));

  // Başkan(lar): club_members.role='ADMIN' — /u/[id] linki için (Aşama 3C).
  const presidents: MemberProfile[] = memberRows
    .filter((row) => row.role?.toString().trim().toUpperCase() === "ADMIN")
    .map(unwrapMember)
    .filter((p): p is MemberProfile => Boolean(p));

  // Danışman adı: yalnız id + full_name seç (profiles broad SELECT kolon-grant'ı
  // id/full_name/role ile sınırlı — email/bio vb. ASLA seçilmez).
  let advisor: MemberProfile | null = null;
  if (club?.advisor_id) {
    const { data: advisorRow } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", club.advisor_id)
      .maybeSingle<MemberProfile>();
    advisor = advisorRow ?? null;
  }

  // Mevcut kullanıcı bu kulübe üye mi?
  const isMember = members.some((m) => m.id === user.id);

  // Üyelerin rozetleri (üye listesinde küçük ikonlar).
  const badgesByUser: Record<string, string[]> = {};
  const memberIds = members.map((m) => m.id);
  if (memberIds.length > 0) {
    const { data: ub } = await supabase
      .from("user_badges")
      .select("user_id, badge_code")
      .in("user_id", memberIds);
    for (const row of (ub ?? []) as { user_id: string; badge_code: string }[]) {
      (badgesByUser[row.user_id] ??= []).push(row.badge_code);
    }
  }

  // Kullanıcının rolünü çek (etkinlik ekleme yetkisi için).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin =
    profile?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";

  // Kullanıcı bu kulübün yöneticisi mi? (Yönet butonu + yetki için)
  const { data: myMembership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isClubAdmin = myMembership?.role?.toString().toUpperCase() === "ADMIN";
  const isClubAdvisor = club?.advisor_id === user.id;
  const canManage = isSuperAdmin || isClubAdvisor || isClubAdmin;

  // Onaylanmış etkinlikleri tarihe göre artan sırada çek.
  const { data: eventsRaw, error: eventsError } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, location, event_attendees(user_id)",
    )
    .eq("club_id", id)
    .eq("status", "APPROVED")
    .order("event_date", { ascending: true })
    .order("id", { ascending: true });

  if (eventsError) {
    console.error("[ClubDetail] Etkinlikler çekme hatası:", eventsError);
  }

  const events = (eventsRaw ?? []) as ClubEvent[];

  // Detayla BİREBİR aynı sayı: biletli etkinlikte bilet, RSVP'de attendees
  // (tek batch RPC). Hata/eksikte event_attendees sayısına düşülür.
  const attendanceCounts = await fetchAttendanceCounts(
    supabase,
    events.map((e) => e.id),
  );

  // Galeri şeridi: kulübün etkinliklerinden son kareler (RLS: yalnız APPROVED
  // etkinliklerin fotoğrafları herkese görünür).
  const { data: galleryRaw } = await supabase
    .from("event_photos")
    .select("id, storage_path, event_id, events!inner(club_id)")
    .eq("events.club_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(8);
  const gallery = ((galleryRaw ?? []) as unknown as {
    id: string;
    storage_path: string;
    event_id: string;
  }[]).map((g) => ({
    id: g.id,
    event_id: g.event_id,
    url: supabase.storage.from("club-images").getPublicUrl(g.storage_path).data
      .publicUrl,
  }));

  const initials = club?.name.slice(0, 2).toUpperCase() ?? "";
  // NOT: whatsapp_url genel iletişim listesinde GÖSTERİLMEZ — WhatsApp grup
  // daveti yalnızca onaylı üyeye özel bir buton olarak sunulur (spam koruması).
  // Kullanıcı-girdisi harici linkler XSS'e karşı yalnız http(s) şemasıyla render
  // edilir; geçersiz (ör. javascript:) değer null döner ve link gösterilmez (Y4).
  const whatsappHref = safeExternalHref(club?.whatsapp_url);
  const instagramHref = safeExternalHref(club?.instagram_url);
  const hasContact = Boolean(
    club?.contact_email || club?.contact_phone || instagramHref,
  );

  return (
    <main className="relative">
      <div className="mx-auto w-full max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="pt-6">
          <Link
            href="/clubs"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </Link>
        </div>

        {!club ? (
          <div className="mt-16">
            <EmptyState
              icon={SearchX}
              title={t("notFoundTitle")}
              description={t("notFoundBody")}
              action={
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ size: "lg" }), "gap-2")}
                >
                  <ArrowLeft className="size-4" />
                  {t("backToDashboard")}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {/* Kapak banner'ı */}
            <div className="relative mt-4 h-40 w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/30 via-muted to-muted sm:h-52">
              <ImageWithFallback
                src={club.cover_url}
                alt={t("coverAlt", { name: club.name })}
                sizes="(max-width: 1024px) 100vw, 1024px"
                fallback={null}
              />
            </div>

            {/* Üste binen logo + başlık + aksiyonlar */}
            <div className="relative -mt-12 px-1 sm:px-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-muted text-xl font-bold text-foreground shadow-sm sm:size-24">
                    <ImageWithFallback
                      src={club.logo_url}
                      alt={t("logoAlt", { name: club.name })}
                      sizes="96px"
                      fallback={<span>{initials}</span>}
                    />
                  </div>
                  <div className="pb-1">
                    <Badge variant="primary">
                      <Users className="size-3" />
                      {categoryLabel(club.category, tCategories) ??
                        t("defaultCategory")}
                    </Badge>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                      {club.name}
                    </h1>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 pb-1">
                  {canManage && (
                    <Link
                      href={`/clubs/${club.id}/manage`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "gap-2",
                      )}
                    >
                      <Settings className="size-4" />
                      {t("manage")}
                    </Link>
                  )}
                  {/* Kulübü yönetene (okul/danışman/başkan) katılma teklif edilmez. */}
                  {!canManage && (
                    <JoinButton
                      clubId={club.id}
                      userId={user.id}
                      isMember={isMember}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Sekmeler: Hakkında | Etkinlikler | Üyeler */}
            <Tabs defaultValue="about" className="mt-8">
              <TabsList>
                <TabsTab value="about">
                  <Info className="size-4" />
                  {t("about")}
                </TabsTab>
                <TabsTab value="events">
                  <CalendarDays className="size-4" />
                  {t("tabEvents")}
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                    {events.length}
                  </span>
                </TabsTab>
                <TabsTab value="members">
                  <Users className="size-4" />
                  {t("tabMembers")}
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                    {members.length}
                  </span>
                </TabsTab>
              </TabsList>

              {/* Hakkında */}
              <TabsPanel value="about" className="space-y-6">
                {/* WhatsApp grup daveti — YALNIZCA onaylı üyeye görünür
                    (spam koruması). Üye olmayan bu bloğu göremez. */}
                {isMember && whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 p-4 transition-colors hover:border-success/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                        <MessageCircle className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {t("whatsappJoinTitle")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t("whatsappJoinDesc")}
                        </span>
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-success-foreground">
                      <span className="hidden sm:inline">
                        {t("whatsappJoin")}
                      </span>
                      <ExternalLink className="size-4" />
                    </span>
                  </a>
                )}

                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {t("about")}
                  </h2>
                  {/* CRLF normalize: hydration determinizmi (bkz. lib/text.ts) */}
                  <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">
                    {club.description?.trim()
                      ? normalizeMultiline(club.description)
                      : t("noDescription")}
                  </p>
                </section>

                {/* Yönetim: danışman + başkan(lar), /u/[id] profiline linkli
                    (Aşama 3C). Alan boşsa kart hiç görünmez — bakan yönetici
                    (danışman/başkan/okul) ise compose butonları için görünür. */}
                {(advisor || presidents.length > 0 || canManage) && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <Users className="size-4 text-primary" />
                      {t("leadershipTitle")}
                    </h2>
                    {(advisor || presidents.length > 0) && (
                      <ul className="mt-3 space-y-3">
                        {advisor && (
                          <LeaderRow
                            icon={GraduationCap}
                            label={roleLabel("ADVISOR", tRoleLabels)}
                            person={advisor}
                            fallbackName={t("unnamedMember")}
                          />
                        )}
                        {presidents.map((p) => (
                          <LeaderRow
                            key={p.id}
                            icon={Crown}
                            label={roleLabel("PRESIDENT", tRoleLabels)}
                            person={p}
                            fallbackName={t("unnamedMember")}
                          />
                        ))}
                      </ul>
                    )}

                    {/* Compose giriş noktaları (Aşama 4C) — görünürlük bakan
                        rolünden; karşı taraf atanmamış olsa da buton gösterilir
                        (kanal club_id ile açılır, atanınca karşı taraf görür).
                        Gerçek yetki open_conversation RPC + RLS'te. */}
                    {canManage && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isClubAdvisor && (
                          <ComposeButton
                            type="ADVISOR_PRESIDENT"
                            clubId={club.id}
                            label={tMessages("compose.toPresident")}
                          />
                        )}
                        {isClubAdmin && (
                          <ComposeButton
                            type="ADVISOR_PRESIDENT"
                            clubId={club.id}
                            label={tMessages("compose.toAdvisor")}
                          />
                        )}
                        {isSuperAdmin && (
                          <ComposeButton
                            type="ADMIN_PRESIDENT"
                            clubId={club.id}
                            label={tMessages("compose.adminDirective")}
                          />
                        )}
                      </div>
                    )}
                  </section>
                )}

                {gallery.length > 0 && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <Images className="size-4 text-primary" />
                      {t("galleryTitle")}
                    </h2>
                    <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                      {gallery.map((g) => (
                        <li key={g.id} className="shrink-0">
                          <Link
                            href={`/events/${g.event_id}`}
                            className="relative block size-24 overflow-hidden rounded-lg border border-border bg-muted transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Image
                              src={g.url}
                              alt={t("galleryAlt")}
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {club.vision?.trim() && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <Target className="size-4 text-primary" />
                      {t("vision")}
                    </h2>
                    <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">
                      {normalizeMultiline(club.vision)}
                    </p>
                  </section>
                )}

                {hasContact && (
                  <div className="flex flex-wrap gap-2">
                    {club.contact_email && (
                      <ContactChip
                        href={`mailto:${club.contact_email}`}
                        icon={<Mail className="size-4 text-primary" />}
                        label={club.contact_email}
                      />
                    )}
                    {club.contact_phone && (
                      <ContactChip
                        href={`tel:${club.contact_phone}`}
                        icon={<Phone className="size-4 text-primary" />}
                        label={club.contact_phone}
                      />
                    )}
                    {instagramHref && (
                      <ContactChip
                        href={instagramHref}
                        external
                        icon={<AtSign className="size-4 text-primary" />}
                        label={t("instagram")}
                      />
                    )}
                  </div>
                )}
              </TabsPanel>

              {/* Etkinlikler — paylaşılan fotoğraflı EventCard (kulübün kapağı
                  etkinlik kapağı olarak; kulüp adı burada gereksiz → gizli). */}
              <TabsPanel value="events">
                {events.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {events.map((ev) => {
                      const attendees = ev.event_attendees ?? [];
                      const cardData: EventCardData = {
                        id: ev.id,
                        title: ev.title,
                        eventDate: ev.event_date,
                        location: ev.location,
                        clubName: null,
                        category: club.category,
                        coverUrl: club.cover_url,
                        attendeeCount:
                          attendanceCounts[ev.id] ?? attendees.length,
                      };
                      return (
                        <EventCard
                          key={ev.id}
                          event={cardData}
                          rsvp={{
                            userId: user.id,
                            isAttending: attendees.some(
                              (a) => a.user_id === user.id,
                            ),
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={CalendarDays} title={t("noEvents")} />
                )}
              </TabsPanel>

              {/* Üyeler */}
              <TabsPanel value="members">
                {memberList.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {memberList.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserRound className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {m.full_name ?? t("unnamedMember")}
                        </span>
                        {m.isPresident && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-gold/45 bg-[color-mix(in_oklab,var(--accent-gold)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-accent-gold uppercase">
                            <Crown className="size-3" />
                            {roleLabel("PRESIDENT", tRoleLabels)}
                          </span>
                        )}
                        <BadgeIconRow codes={badgesByUser[m.id] ?? []} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={Users} title={t("noMembers")} />
                )}
              </TabsPanel>
            </Tabs>
          </>
        )}
      </div>
    </main>
  );
}

/** Yönetim satırı: ikon + rol etiketi + /u/[id] profiline linkli isim.
 *  Link vurgusu mevcut token'lardan (hover'da primary + altı çizili). */
function LeaderRow({
  icon: Icon,
  label,
  person,
  fallbackName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  person: { id: string; full_name: string | null };
  fallbackName: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <Link
          href={`/u/${person.id}`}
          className="block truncate text-sm font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          {person.full_name ?? fallbackName}
        </Link>
      </div>
    </li>
  );
}

function ContactChip({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      {icon}
      {label}
    </a>
  );
}

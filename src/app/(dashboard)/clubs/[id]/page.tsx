import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  AtSign,
  CalendarDays,
  Clock,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  SearchX,
  Settings,
  Target,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { RSVPButton } from "@/components/shared/rsvp-button";
import { JoinButton } from "./join-button";

export const dynamic = "force-dynamic";

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
  const locale = await getLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  });
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

  // Kulüp üyelerini ve profillerini (isim) çek.
  const { data: membersRaw, error: membersError } = await supabase
    .from("club_members")
    .select("user_id(id, full_name)")
    .eq("club_id", id);

  if (membersError) {
    console.error("[ClubDetail] Üyeler çekme hatası:", membersError);
  }

  // Embed sonucunu düz bir profil listesine normalize et.
  const members: MemberProfile[] = (
    (membersRaw ?? []) as { user_id: MemberProfile | MemberProfile[] | null }[]
  )
    .map((row) => (Array.isArray(row.user_id) ? row.user_id[0] : row.user_id))
    .filter((p): p is MemberProfile => Boolean(p));

  // Mevcut kullanıcı bu kulübe üye mi?
  const isMember = members.some((m) => m.id === user.id);

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
    .order("event_date", { ascending: true });

  if (eventsError) {
    console.error("[ClubDetail] Etkinlikler çekme hatası:", eventsError);
  }

  const events = (eventsRaw ?? []) as ClubEvent[];
  const initials = club?.name.slice(0, 2).toUpperCase() ?? "";
  const hasContact = Boolean(
    club?.contact_email ||
      club?.contact_phone ||
      club?.whatsapp_url ||
      club?.instagram_url,
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
            <div className="mt-4 h-40 w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/30 via-muted to-muted sm:h-52">
              {club.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.cover_url}
                  alt={t("coverAlt", { name: club.name })}
                  className="size-full object-cover"
                />
              )}
            </div>

            {/* Üste binen logo + başlık + aksiyonlar */}
            <div className="relative -mt-12 px-1 sm:px-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-muted text-xl font-bold text-foreground shadow-sm sm:size-24">
                    {club.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={club.logo_url}
                        alt={t("logoAlt", { name: club.name })}
                        className="size-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="pb-1">
                    <Badge variant="primary">
                      <Users className="size-3" />
                      {club.category ?? t("defaultCategory")}
                    </Badge>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
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
                  <JoinButton
                    clubId={club.id}
                    userId={user.id}
                    isMember={isMember}
                  />
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
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {t("about")}
                  </h2>
                  <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">
                    {club.description?.trim()
                      ? club.description
                      : t("noDescription")}
                  </p>
                </section>

                {club.vision?.trim() && (
                  <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                      <Target className="size-4 text-primary" />
                      {t("vision")}
                    </h2>
                    <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">
                      {club.vision}
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
                    {club.whatsapp_url && (
                      <ContactChip
                        href={club.whatsapp_url}
                        external
                        icon={<MessageCircle className="size-4 text-primary" />}
                        label={t("whatsapp")}
                      />
                    )}
                    {club.instagram_url && (
                      <ContactChip
                        href={club.instagram_url}
                        external
                        icon={<AtSign className="size-4 text-primary" />}
                        label={t("instagram")}
                      />
                    )}
                  </div>
                )}
              </TabsPanel>

              {/* Etkinlikler */}
              <TabsPanel value="events">
                {events.length > 0 ? (
                  <ul className="space-y-3">
                    {events.map((ev) => {
                      const attendees = ev.event_attendees ?? [];
                      const isAttending = attendees.some(
                        (a) => a.user_id === user.id,
                      );
                      return (
                        <li
                          key={ev.id}
                          className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                        >
                          <Link
                            href={`/events/${ev.id}`}
                            className="font-semibold tracking-tight transition-colors hover:text-primary"
                          >
                            {ev.title}
                          </Link>
                          {ev.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {ev.description}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5 text-primary" />
                              {dateFormatter.format(new Date(ev.event_date))}
                            </span>
                            {ev.location && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="size-3.5 text-primary" />
                                {ev.location}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Users className="size-3.5" />
                              {t("attendeeCount", { count: attendees.length })}
                            </span>
                            <RSVPButton
                              eventId={ev.id}
                              userId={user.id}
                              isAttending={isAttending}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState icon={CalendarDays} title={t("noEvents")} />
                )}
              </TabsPanel>

              {/* Üyeler */}
              <TabsPanel value="members">
                {members.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserRound className="size-4" />
                        </span>
                        <span className="truncate text-sm font-medium">
                          {m.full_name ?? t("unnamedMember")}
                        </span>
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

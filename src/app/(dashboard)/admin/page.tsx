import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { NewClubForm } from "./new-club-form";
import { FairModeToggle } from "./fair-mode-toggle";
import { AdminAssignments, type Option } from "./admin-assignments";
import {
  AdminApprovals,
  type ClubSetting,
  type PendingEvent,
} from "./admin-approvals";
import type { EventDocument } from "../clubs/[id]/manage/event-documents";
import {
  AdminAnalytics,
  type ClubStat,
  type MemberGrowthPoint,
  type Overview,
} from "./admin-analytics";

const DOC_BUCKET = "event-docs";

// Route Cache'i devre dışı bırak: rol kontrolü her istekte güncel veriyle yapılsın.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page");
  return { title: t("title") };
}

export default async function AdminPage() {
  const t = await getTranslations("admin.page");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Güvenlik: yalnızca SUPER_ADMIN erişebilir. Aksi halde panele geri gönder.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[admin] Profil çekilemedi:", profileError);
  }

  // Rolü boşluk/büyük-küçük harf farklarına karşı dayanıklı şekilde karşılaştır.
  const normalizedRole = profile?.role?.toString().trim().toUpperCase();

  if (normalizedRole !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  // Atama formları için kulüp ve kullanıcı listeleri (email OKUNMAZ; full_name).
  const { data: clubsRaw } = await supabase
    .from("clubs")
    .select("id, name, requires_advisor_approval")
    .order("name", { ascending: true });
  const { data: usersRaw } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  const clubOptions: Option[] = (clubsRaw ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));
  const userOptions: Option[] = (usersRaw ?? []).map((u) => ({
    id: u.id,
    label: u.full_name ?? t("unnamedUser"),
  }));
  const clubSettings: ClubSetting[] = (clubsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    requires_advisor_approval: c.requires_advisor_approval,
  }));

  // Okul onayı bekleyen etkinlikler (tüm kulüpler) + kulüp adı.
  const { data: pendingRaw } = await supabase
    .from("events")
    .select("id, title, event_date, location, review_note, clubs(name)")
    .eq("status", "PENDING_SCHOOL")
    .order("event_date", { ascending: true });

  const pendingBase = (
    (pendingRaw ?? []) as unknown as {
      id: string;
      title: string;
      event_date: string;
      location: string | null;
      review_note: string | null;
      clubs: { name: string } | { name: string }[] | null;
    }[]
  ).map((e) => {
    const club = Array.isArray(e.clubs) ? e.clubs[0] : e.clubs;
    return {
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      location: e.location,
      review_note: e.review_note,
      club_name: club?.name ?? null,
    };
  });

  // Bekleyen etkinliklerin belge ekleri (signed URL ile; public URL ASLA).
  const docsByEvent: Record<string, EventDocument[]> = {};
  const pendingIds = pendingBase.map((e) => e.id);
  if (pendingIds.length > 0) {
    const { data: docRaw } = await supabase
      .from("event_documents")
      .select("id, event_id, file_url, file_name, note")
      .in("event_id", pendingIds)
      .order("created_at", { ascending: true });

    for (const d of (docRaw ?? []) as {
      id: string;
      event_id: string;
      file_url: string;
      file_name: string;
      note: string | null;
    }[]) {
      let signedUrl: string | null = null;
      if (d.file_url) {
        const { data: signed } = await supabase.storage
          .from(DOC_BUCKET)
          .createSignedUrl(d.file_url, 120);
        signedUrl = signed?.signedUrl ?? null;
      }
      (docsByEvent[d.event_id] ??= []).push({
        id: d.id,
        file_name: d.file_name,
        note: d.note,
        signedUrl,
        canDelete: false, // okul yalnız görüntüler.
      });
    }
  }

  const pending: PendingEvent[] = pendingBase.map((e) => ({
    ...e,
    documents: docsByEvent[e.id] ?? [],
  }));

  // Analitik (yalnız SUPER_ADMIN — RPC'ler is_super_admin() içeriyor).
  const [
    { data: overviewRows },
    { data: clubStatsRows },
    { data: growthRows },
  ] = await Promise.all([
    supabase.rpc("analytics_overview"),
    supabase.rpc("analytics_clubs"),
    supabase.rpc("analytics_member_growth"),
  ]);

  const overview: Overview | null =
    (overviewRows as Overview[] | null)?.[0] ?? null;
  const clubStats = (clubStatsRows as ClubStat[] | null) ?? [];
  const memberGrowth = (growthRows as MemberGrowthPoint[] | null) ?? [];

  // Kulüp Fuarı modu ayarı.
  const { data: fairRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fair_mode_enabled")
    .maybeSingle();
  const fairEnabled = fairRow?.value === "true";

  return (
    <PageShell>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTab value="approvals">
            <ClipboardCheck className="size-4" />
            {t("tabApprovals")}
            {pending.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">
                {pending.length}
              </span>
            )}
          </TabsTab>
          <TabsTab value="clubs">
            <Building2 className="size-4" />
            {t("tabClubs")}
          </TabsTab>
          <TabsTab value="assignments">
            <UserCog className="size-4" />
            {t("tabAssignments")}
          </TabsTab>
          <TabsTab value="analytics">
            <BarChart3 className="size-4" />
            {t("tabAnalytics")}
          </TabsTab>
        </TabsList>

        <TabsPanel value="approvals">
          <AdminApprovals
            pending={pending}
            clubs={clubSettings}
            userId={user.id}
          />
        </TabsPanel>

        <TabsPanel value="clubs" className="space-y-6">
          <FairModeToggle initialEnabled={fairEnabled} />
          <NewClubForm />
        </TabsPanel>

        <TabsPanel value="assignments">
          <AdminAssignments clubs={clubOptions} users={userOptions} />
        </TabsPanel>

        <TabsPanel value="analytics">
          <AdminAnalytics
            overview={overview}
            clubs={clubStats}
            growth={memberGrowth}
          />
        </TabsPanel>
      </Tabs>
    </PageShell>
  );
}

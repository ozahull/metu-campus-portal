import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminSurface } from "@/components/shared/admin-surface";
import { PageShell } from "@/components/shared/page-shell";
import { AdminShell } from "./admin-shell";
import { type Option } from "./admin-assignments";
import { type PendingEvent } from "./admin-approvals";
import { type PendingClubRequest } from "./admin-club-requests";
import { type ClubSetting } from "./admin-settings";
import type { EventDocument } from "../clubs/[id]/manage/event-documents";
import {
  type ClubStat,
  type MemberGrowthPoint,
  type Overview,
} from "./admin-analytics";

const DOC_BUCKET = "event-docs";
// Topluluk açma başvurusu belgeleri ayrı PRIVATE bucket (event-docs'a dokunma).
const DOC_BUCKET_REQ = "club-request-docs";

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
  // advisor_id de çekilir: atama formu MEVCUT danışmanı gösterip önseçebilsin
  // (kaydedilen atamanın reload sonrası GÖRÜNMESİ için read-back — bkz. §9 bugfix).
  const { data: clubsRaw } = await supabase
    .from("clubs")
    .select("id, name, requires_advisor_approval, advisor_id")
    .order("name", { ascending: true });
  const { data: usersRaw } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });

  const clubOptions: Option[] = (clubsRaw ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));
  // Kulüp → mevcut danışman id eşlemesi (atama formu read-back'i için).
  const clubAdvisors: Record<string, string | null> = {};
  for (const c of clubsRaw ?? []) {
    clubAdvisors[c.id] = c.advisor_id ?? null;
  }
  const userOptions: Option[] = (usersRaw ?? []).map((u) => ({
    id: u.id,
    label: u.full_name ?? t("unnamedUser"),
  }));
  // HOCA (ADVISOR) rol atama listeleri — profiles.role tabanlı; clubs.advisor_id
  // (kulübün akademik danışmanı) kavramından BAĞIMSIZ. role SELECT'te kolon-grant
  // ile açıktır (email değil). Aday = 'USER' (hoca yapılabilir); hoca = 'ADVISOR'.
  const roleOf = (r: string | null | undefined) =>
    r?.toString().trim().toUpperCase();
  const roleCandidates: Option[] = (usersRaw ?? [])
    .filter((u) => roleOf(u.role) === "USER")
    .map((u) => ({ id: u.id, label: u.full_name ?? t("unnamedUser") }));
  const advisors: Option[] = (usersRaw ?? [])
    .filter((u) => roleOf(u.role) === "ADVISOR")
    .map((u) => ({ id: u.id, label: u.full_name ?? t("unnamedUser") }));
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

  // Topluluk açma başvuruları (PENDING) — Aşama 2 Commit C. Başvuran hoca adı
  // için requested_by → full_name eşlemesi usersRaw'dan (ekstra sorgu YOK).
  const nameById = new Map<string, string>();
  for (const u of usersRaw ?? []) {
    nameById.set(u.id, u.full_name ?? t("unnamedUser"));
  }

  const { data: reqRaw } = await supabase
    .from("club_requests")
    .select(
      "id, name, description, category, rationale, created_at, requested_by",
    )
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  const reqBase = (reqRaw ?? []) as {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    rationale: string | null;
    created_at: string;
    requested_by: string;
  }[];

  // Başvuru belgeleri: signed URL ile (public URL ASLA; docsByEvent deseninin
  // kopyası, ayrı club-request-docs bucket). Okul yalnız görüntüler → canDelete=false.
  const reqDocs: Record<string, EventDocument[]> = {};
  const reqIds = reqBase.map((r) => r.id);
  if (reqIds.length > 0) {
    const { data: reqDocRaw } = await supabase
      .from("club_request_documents")
      .select("id, request_id, file_url, file_name, note")
      .in("request_id", reqIds)
      .order("created_at", { ascending: true });

    for (const d of (reqDocRaw ?? []) as {
      id: string;
      request_id: string;
      file_url: string;
      file_name: string;
      note: string | null;
    }[]) {
      let signedUrl: string | null = null;
      if (d.file_url) {
        const { data: signed } = await supabase.storage
          .from(DOC_BUCKET_REQ)
          .createSignedUrl(d.file_url, 120);
        signedUrl = signed?.signedUrl ?? null;
      }
      (reqDocs[d.request_id] ??= []).push({
        id: d.id,
        file_name: d.file_name,
        note: d.note,
        signedUrl,
        canDelete: false,
      });
    }
  }

  const clubRequests: PendingClubRequest[] = reqBase.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    rationale: r.rationale,
    requester_name: nameById.get(r.requested_by) ?? t("unnamedUser"),
    created_at: r.created_at,
    documents: reqDocs[r.id] ?? [],
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
    <AdminSurface>
      <PageShell glow={false}>
        <header className="mb-8 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </header>

        <AdminShell
          overview={overview}
          pending={pending}
          clubRequests={clubRequests}
          clubSettings={clubSettings}
          clubStats={clubStats}
          memberGrowth={memberGrowth}
          clubOptions={clubOptions}
          userOptions={userOptions}
          clubAdvisors={clubAdvisors}
          roleCandidates={roleCandidates}
          advisors={advisors}
          fairEnabled={fairEnabled}
          userId={user.id}
        />
      </PageShell>
    </AdminSurface>
  );
}

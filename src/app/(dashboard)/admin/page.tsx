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

  // Atama formları için kulüp listesi (bounded — kampüs kulüp sayısı küçük).
  // advisor_id de çekilir: atama formu MEVCUT danışmanı gösterip önseçebilsin
  // (kaydedilen atamanın reload sonrası GÖRÜNMESİ için read-back — bkz. §9 bugfix).
  //
  // ÖLÇEK (Commit 2): KULLANICI listesi ARTIK topluca çekilmez. Eskiden 5.000+
  // profil .limit(500) ile geliyordu → atama dropdown'ları %90 kör + ~2s. Kullanıcı
  // seçimi AdminUserPicker ile SUNUCU TARAFINDA aranır/sayfalanır; burada yalnız
  // GEREKLİ isimler (atanmış danışmanlar, başvuranlar) targeted `.in()` ile çözülür.
  const { data: clubsRaw } = await supabase
    .from("clubs")
    .select("id, name, requires_advisor_approval, advisor_id")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(500);

  const clubOptions: Option[] = (clubsRaw ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));
  // Kulüp → mevcut danışman id eşlemesi (atama formu read-back'i için).
  const clubAdvisors: Record<string, string | null> = {};
  for (const c of clubsRaw ?? []) {
    clubAdvisors[c.id] = c.advisor_id ?? null;
  }
  const clubSettings: ClubSetting[] = (clubsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    requires_advisor_approval: c.requires_advisor_approval,
  }));

  // Atanmış danışmanların adları — YALNIZ ilgili id'ler (targeted .in). Picker
  // önseçimi (kulüp seçilince mevcut danışman çipi) + "Mevcut Atamalar" read-back.
  const advisorIds = Array.from(
    new Set(
      (clubsRaw ?? [])
        .map((c) => c.advisor_id)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const advisorNames: Record<string, string> = {};
  if (advisorIds.length > 0) {
    const { data: advNameRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", advisorIds);
    for (const r of advNameRows ?? []) {
      advisorNames[r.id] = r.full_name ?? t("unnamedUser");
    }
  }

  // Mevcut hocalar (profiles.role='ADVISOR') — sınırlı, küçük küme (okulun atadığı
  // öğretim üyeleri; clubs.advisor_id'den BAĞIMSIZ kavram). role SELECT'te
  // kolon-grant ile açık (email değil). Rol geri alma (demote) read-back'i için.
  const { data: advisorRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "ADVISOR")
    .order("full_name", { ascending: true })
    .order("id", { ascending: true });
  const advisors: Option[] = (advisorRows ?? []).map((u) => ({
    id: u.id,
    label: u.full_name ?? t("unnamedUser"),
  }));

  // Okul onayı bekleyen etkinlikler (tüm kulüpler) + kulüp adı.
  const { data: pendingRaw } = await supabase
    .from("events")
    .select("id, title, event_date, location, review_note, clubs(name)")
    .eq("status", "PENDING_SCHOOL")
    .order("event_date", { ascending: true })
    .order("id", { ascending: true });

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
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    // Signed URL üretimi PARALEL (N+1 sıralı await yerine — clubs/new deseni).
    const docRows = (docRaw ?? []) as {
      id: string;
      event_id: string;
      file_url: string;
      file_name: string;
      note: string | null;
    }[];
    const signedDocs = await Promise.all(
      docRows.map(async (d) => {
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

  // Topluluk açma başvuruları (PENDING) — Aşama 2 Commit C.
  const { data: reqRaw } = await supabase
    .from("club_requests")
    .select(
      "id, name, description, category, rationale, created_at, requested_by",
    )
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const reqBase = (reqRaw ?? []) as {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    rationale: string | null;
    created_at: string;
    requested_by: string;
  }[];

  // Başvuran hoca adı: requested_by → full_name, YALNIZ ilgili id'ler (targeted
  // .in). Tüm kullanıcı listesi ARTIK çekilmiyor (ölçek Commit 2).
  const nameById = new Map<string, string>();
  const requesterIds = Array.from(new Set(reqBase.map((r) => r.requested_by)));
  if (requesterIds.length > 0) {
    const { data: reqUserRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", requesterIds);
    for (const u of reqUserRows ?? []) {
      nameById.set(u.id, u.full_name ?? t("unnamedUser"));
    }
  }

  // Başvuru belgeleri: signed URL ile (public URL ASLA; docsByEvent deseninin
  // kopyası, ayrı club-request-docs bucket). Okul yalnız görüntüler → canDelete=false.
  const reqDocs: Record<string, EventDocument[]> = {};
  const reqIds = reqBase.map((r) => r.id);
  if (reqIds.length > 0) {
    const { data: reqDocRaw } = await supabase
      .from("club_request_documents")
      .select("id, request_id, file_url, file_name, note")
      .in("request_id", reqIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    // Signed URL üretimi PARALEL (N+1 sıralı await yerine).
    const reqDocRows = (reqDocRaw ?? []) as {
      id: string;
      request_id: string;
      file_url: string;
      file_name: string;
      note: string | null;
    }[];
    const signedReqDocs = await Promise.all(
      reqDocRows.map(async (d) => {
        let signedUrl: string | null = null;
        if (d.file_url) {
          const { data: signed } = await supabase.storage
            .from(DOC_BUCKET_REQ)
            .createSignedUrl(d.file_url, 120);
          signedUrl = signed?.signedUrl ?? null;
        }
        return { d, signedUrl };
      }),
    );
    for (const { d, signedUrl } of signedReqDocs) {
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
          advisorNames={advisorNames}
          clubAdvisors={clubAdvisors}
          advisors={advisors}
          fairEnabled={fairEnabled}
          userId={user.id}
        />
      </PageShell>
    </AdminSurface>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewClubForm } from "./new-club-form";
import { AdminAssignments, type Option } from "./admin-assignments";
import {
  AdminApprovals,
  type ClubSetting,
  type PendingEvent,
} from "./admin-approvals";
import type { EventDocument } from "../clubs/[id]/manage/event-documents";

const DOC_BUCKET = "event-docs";

// Route Cache'i devre dışı bırak: rol kontrolü her istekte güncel veriyle yapılsın.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
    label: u.full_name ?? "(İsimsiz kullanıcı)",
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

  return (
    <main className="dark relative min-h-svh overflow-hidden bg-zinc-950 px-4 py-12 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.22),transparent)]"
      />
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Yönetim Paneli
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Süper yönetici · kulüp, yönetici ve danışman yönetimi
          </p>
        </header>

        <div className="flex justify-center">
          <NewClubForm />
        </div>

        <AdminAssignments clubs={clubOptions} users={userOptions} />

        <AdminApprovals pending={pending} clubs={clubSettings} userId={user.id} />
      </div>
    </main>
  );
}

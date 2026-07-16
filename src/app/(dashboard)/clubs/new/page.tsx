import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { ClubRequestForm, type ClubRequestRecord } from "./club-request-form";
import type { ClubRequestDocument } from "./club-request-documents";

export const dynamic = "force-dynamic";

// event-docs deseniyle aynı PRIVATE bucket; erişim yalnız signed URL ile.
const DOC_BUCKET = "club-request-docs";

type DocRow = {
  id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  note: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clubRequest");
  return { title: t("metaTitle") };
}

export default async function NewClubRequestPage() {
  const t = await getTranslations("clubRequest");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Bu sayfa yalnız HOCA (ADVISOR) içindir; değilse keşif sayfasına yönlendir.
  // (RLS + club_request_submit RPC de is_advisor() ile korur — UI ilk kapı.)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdvisor =
    profile?.role?.toString().trim().toUpperCase() === "ADVISOR";
  if (!isAdvisor) redirect("/clubs");

  // Bu hocanın EN SON başvurusu (RLS zaten yalnız kendi kaydını görmesine izin verir).
  const { data: reqRaw } = await supabase
    .from("club_requests")
    .select(
      "id, name, description, category, rationale, status, review_note, created_club_id, created_at",
    )
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existing = (reqRaw ?? null) as ClubRequestRecord | null;

  // İlişkili belgeler (varsa) + kısa ömürlü signed URL (public URL ASLA —
  // event-documents.tsx server-side deseninin birebir kopyası).
  let documents: ClubRequestDocument[] = [];
  if (existing) {
    const { data: docRaw } = await supabase
      .from("club_request_documents")
      .select("id, uploaded_by, file_url, file_name, note")
      .eq("request_id", existing.id)
      .order("created_at", { ascending: true });

    documents = await Promise.all(
      ((docRaw ?? []) as DocRow[]).map(async (d) => {
        let signedUrl: string | null = null;
        if (d.file_url) {
          const { data: signed } = await supabase.storage
            .from(DOC_BUCKET)
            .createSignedUrl(d.file_url, 120);
          signedUrl = signed?.signedUrl ?? null;
        }
        return {
          id: d.id,
          file_name: d.file_name,
          note: d.note,
          signedUrl,
          canDelete: d.uploaded_by === user.id,
        };
      }),
    );
  }

  return (
    <PageShell>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          {t("pageSubtitle")}
        </p>
      </header>

      <div className="max-w-2xl">
        {/*
          key = başvuru kimliği + durum. Durum GERÇEKTEN değişince (ör. okul
          PENDING→CHANGES_REQUESTED yapınca) form remount olup alanları doğru
          değerlerle yeniden başlatır; aynı durumdaki tazelemelerde (belge
          yükleme) remount OLMAZ, kullanıcının yazdığı düzenlemeler korunur.
        */}
        <ClubRequestForm
          key={existing ? `${existing.id}:${existing.status}` : "new"}
          userId={user.id}
          existing={existing}
          documents={documents}
        />
      </div>
    </PageShell>
  );
}

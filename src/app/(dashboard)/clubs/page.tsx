import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/shared/page-shell";
import { ClubsCollection } from "@/components/shared/clubs-collection";
import type { Club } from "@/components/shared/club-card";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("communities") };
}

type ClubQueryRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  logo_url: string | null;
  cover_url: string | null;
  club_members: { count: number }[] | null;
};

export default async function ClubsPage() {
  const t = await getTranslations("clubs");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // NOT: category/logo/cover + üye sayısı (club_members(count)) yalnızca kart
  // sunumu için EK olarak çekilir; filtreleme/RLS/mutasyon aynen korunur.
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, description, category, logo_url, cover_url, club_members(count)",
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[Clubs] Kulüpler çekme hatası:", error);
  }

  const clubs: Club[] = ((data ?? []) as unknown as ClubQueryRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    category: c.category,
    logo_url: c.logo_url,
    cover_url: c.cover_url,
    memberCount: c.club_members?.[0]?.count ?? 0,
  }));

  return (
    <PageShell>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t("listTitle")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("listSubtitle")}
        </p>
      </header>

      <ClubsCollection clubs={clubs} showSearch />
    </PageShell>
  );
}

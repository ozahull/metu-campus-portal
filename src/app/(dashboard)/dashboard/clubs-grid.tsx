import { getTranslations } from "next-intl/server";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { ClubsCollection } from "@/components/shared/clubs-collection";
import type { Club } from "@/components/shared/club-card";

type ClubQueryRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  logo_url: string | null;
  cover_url: string | null;
  club_members: { count: number }[] | null;
};

export async function ClubsGrid() {
  const t = await getTranslations("home");
  const supabase = await createClient();

  // NOT: category/logo/cover + üye sayısı yalnızca kart sunumu için EK çekilir.
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, description, category, logo_url, cover_url, club_members(count)",
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[Dashboard] Kulüpler çekme hatası:", error);
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

  if (clubs.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("activeClubsEmptyTitle")}
        description={t("activeClubsEmptyBody")}
      />
    );
  }

  return <ClubsCollection clubs={clubs} />;
}

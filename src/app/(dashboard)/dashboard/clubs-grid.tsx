import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  // D22: hata boş-durumla KARIŞMAZ — "aktif kulüp yok" yerine "yüklenemedi +
  // tekrar dene" gösterilir (sayfa force-dynamic; link yeniden çeker).
  if (error) {
    console.error("[Dashboard] Kulüpler çekme hatası:", error);
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("clubsError")}
        description={t("clubsErrorBody")}
        action={
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
          >
            <RotateCw className="size-4" />
            {t("clubsRetry")}
          </Link>
        }
      />
    );
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

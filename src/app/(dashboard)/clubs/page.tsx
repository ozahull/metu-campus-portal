import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
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

  // Rol: yalnız HOCA'ya "topluluk aç" CTA'sı gösterilir (nav'a kalıcı link
  // eklenmez — kapsam dışı). Diğer sorgular/RLS aynen korunur.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdvisor =
    profile?.role?.toString().trim().toUpperCase() === "ADVISOR";
  const tReq = await getTranslations("clubRequest");

  // NOT: category/logo/cover + üye sayısı (club_members(count)) yalnızca kart
  // sunumu için EK olarak çekilir; filtreleme/RLS/mutasyon aynen korunur.
  const { data, error } = await supabase
    .from("clubs")
    .select(
      "id, name, description, category, logo_url, cover_url, club_members(count)",
    )
    .order("name", { ascending: true })
    .order("id", { ascending: true });

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

      {isAdvisor && (
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">
                {tReq("cta.title")}
              </h2>
              <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
                {tReq("cta.body")}
              </p>
            </div>
          </div>
          <Link
            href="/clubs/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "shrink-0 gap-1.5 font-medium",
            )}
          >
            <Plus className="size-4" />
            {tReq("cta.button")}
          </Link>
        </div>
      )}

      <ClubsCollection clubs={clubs} showSearch />
    </PageShell>
  );
}

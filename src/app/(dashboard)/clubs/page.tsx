import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ClubsExplorer } from "./clubs-explorer";
import type { Club } from "@/components/shared/club-card";

export const dynamic = "force-dynamic";

export default async function ClubsPage() {
  const t = await getTranslations("clubs");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Clubs] Kulüpler çekme hatası:", error);
  }

  const clubs = (data ?? []) as Club[];

  return (
    <main className="relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("listTitle")}
          </h1>
          <p className="mt-2 text-base text-zinc-400">
            {t("listSubtitle")}
          </p>
        </header>

        <ClubsExplorer clubs={clubs} />
      </div>
    </main>
  );
}

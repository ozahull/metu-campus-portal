import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClubCard, type Club } from "@/components/shared/club-card";

export async function ClubsGrid() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Dashboard] Kulüpler çekme hatası:", error);
  }

  const clubs = (data ?? []) as Club[];

  if (clubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
          <Inbox className="size-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-zinc-300">
          Henüz aktif kulüp bulunmuyor
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Yeni topluluklar eklendiğinde burada görünecek.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewClubForm } from "./new-club-form";
import { AdminAssignments, type Option } from "./admin-assignments";

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
    .select("id, name")
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
      </div>
    </main>
  );
}

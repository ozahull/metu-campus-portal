import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewClubForm } from "./new-club-form";

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

  return (
    <main className="dark relative flex min-h-svh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(132,21,21,0.22),transparent)]"
      />
      <NewClubForm />
    </main>
  );
}

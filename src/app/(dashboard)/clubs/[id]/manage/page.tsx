import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Settings, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClubInfoForm, type ClubInfo } from "./club-info-form";
import { ManageEvents, type ManageEvent } from "./manage-events";
import { ManageMembers, type RosterMember } from "./manage-members";

export const dynamic = "force-dynamic";

type RosterRow = {
  user_id: string;
  role: string;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
};

export default async function ClubManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select(
      "id, name, category, description, vision, logo_url, cover_url, contact_email, contact_phone, whatsapp_url, instagram_url",
    )
    .eq("id", id)
    .maybeSingle<ClubInfo>();

  if (!club) redirect("/dashboard");

  // Erişim: SUPER_ADMIN veya bu kulübün ADMIN'i.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperAdmin =
    profile?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";

  const { data: myMembership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isClubAdmin = myMembership?.role?.toString().toUpperCase() === "ADMIN";

  if (!isSuperAdmin && !isClubAdmin) {
    redirect(`/clubs/${id}`);
  }

  // Etkinlikler (tüm statüler — yöneticiler için).
  const { data: eventsRaw } = await supabase
    .from("events")
    .select("id, title, description, event_date, location, status")
    .eq("club_id", id)
    .order("event_date", { ascending: true });
  const events = (eventsRaw ?? []) as ManageEvent[];

  // Üye listesi (isim + rol).
  const { data: rosterRaw } = await supabase
    .from("club_members")
    .select("user_id, role, profile:user_id(full_name)")
    .eq("club_id", id)
    .order("created_at", { ascending: true });

  const members: RosterMember[] = ((rosterRaw ?? []) as unknown as RosterRow[]).map(
    (r) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return {
        user_id: r.user_id,
        role: r.role,
        full_name: p?.full_name ?? null,
      };
    },
  );

  return (
    <main className="dark relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/clubs/${id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 gap-1.5 text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <ArrowLeft className="size-4" />
          Kulübe Dön
        </Link>

        <header className="mt-6 mb-8 flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ backgroundColor: "#841515" }}
          >
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {club.name} · Yönetim
            </h1>
            <p className="text-sm text-zinc-400">
              {isSuperAdmin ? "Süper yönetici" : "Kulüp yöneticisi"} erişimi
            </p>
          </div>
        </header>

        <div className="space-y-6">
          {/* Kulüp bilgisi */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">
                Kulüp Bilgileri
              </CardTitle>
              <CardDescription>
                Topluluğun genel bilgilerini ve iletişim kanallarını düzenleyin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClubInfoForm club={club} />
            </CardContent>
          </Card>

          {/* Etkinlikler */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <CalendarDays className="size-4 text-[#e7a3a3]" />
                Etkinlikler
              </CardTitle>
              <CardDescription>
                Kulübünüzün etkinliklerini oluşturun, düzenleyin veya silin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageEvents clubId={id} events={events} />
            </CardContent>
          </Card>

          {/* Üyeler */}
          <Card className="border-white/5 bg-zinc-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <Users className="size-4 text-[#e7a3a3]" />
                Üyeler ({members.length})
              </CardTitle>
              <CardDescription>
                Üyeleri yönetin; yönetici atayın veya kulüpten çıkarın.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageMembers clubId={id} members={members} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

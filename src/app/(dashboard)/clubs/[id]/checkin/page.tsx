import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckinScanner, type ApprovedTicket } from "./checkin-scanner";

export const dynamic = "force-dynamic";

type TicketRow = {
  token: string;
  status: string;
  profile: { full_name: string | null } | { full_name: string | null }[] | null;
  events:
    | { title: string; club_id: string }
    | { title: string; club_id: string }[]
    | null;
};

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function CheckinPage({
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
    .select("id, name, advisor_id")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; advisor_id: string | null }>();

  if (!club) redirect("/dashboard");

  // Erişim: SUPER_ADMIN veya bu kulübün danışmanı veya başkanı (ADMIN).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperAdmin =
    profile?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";
  const isClubAdvisor = club.advisor_id === user.id;

  const { data: myMembership } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isClubAdmin = myMembership?.role?.toString().toUpperCase() === "ADMIN";

  if (!isSuperAdmin && !isClubAdvisor && !isClubAdmin) {
    redirect(`/clubs/${id}`);
  }

  // İsimle arama yedeği için: onaylı (henüz giriş yapmamış) biletler.
  const { data: ticketRaw } = await supabase
    .from("tickets")
    .select("token, status, profile:user_id(full_name), events!inner(title, club_id)")
    .eq("events.club_id", id)
    .eq("status", "APPROVED");

  const approved: ApprovedTicket[] = ((ticketRaw ?? []) as unknown as TicketRow[])
    .map((t) => ({
      token: t.token,
      full_name: unwrap(t.profile)?.full_name ?? null,
      event_title: unwrap(t.events)?.title ?? "",
    }))
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "tr"));

  return (
    <main className="dark relative min-h-svh overflow-hidden bg-zinc-950 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(132,21,21,0.18),transparent)]"
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/clubs/${id}/manage`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 gap-1.5 text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <ArrowLeft className="size-4" />
          Yönetime Dön
        </Link>

        <header className="mt-6 mb-8 flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ backgroundColor: "#841515" }}
          >
            <QrCode className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {club.name} · Kapı Kontrol
            </h1>
            <p className="text-sm text-zinc-400">
              QR okutun veya isimle bulup giriş yapın.
            </p>
          </div>
        </header>

        <CheckinScanner approved={approved} />
      </div>
    </main>
  );
}

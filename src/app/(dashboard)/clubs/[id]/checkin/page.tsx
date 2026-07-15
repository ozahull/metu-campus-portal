import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("checkin");
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
    // Dil B "Sessiz Verimlilik": kapı girişi ekranı surface-admin ile beyaz/nötr
    // remap'e döner (navbar Dil A'da kalır). bkz. shared/admin-surface.tsx.
    <main className="surface-admin relative min-h-svh bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="pt-6">
          <Link
            href={`/clubs/${id}/manage`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </Link>
        </div>

        <header className="mt-4 mb-8 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <QrCode className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("title", { name: club.name })}
            </h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </header>

        <CheckinScanner approved={approved} />
      </div>
    </main>
  );
}

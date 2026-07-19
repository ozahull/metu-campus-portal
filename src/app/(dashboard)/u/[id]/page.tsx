import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Building2,
  Crown,
  GraduationCap,
  Layers,
  Pencil,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { nameInitials } from "@/lib/display-name";
import { roleLabel } from "@/lib/role-label";
import { PageShell } from "@/components/shared/page-shell";
import { ComposeButton } from "@/components/messaging/compose-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// PRIVATE 'avatars' bucket — erişim yalnız signed URL ile (public URL YOK).
const AVATAR_BUCKET = "avatars";

type ProfileRelation = "advisor" | "president" | "member";
type ProfileClub = {
  club_id: string;
  club_name: string;
  relation: ProfileRelation;
};
// get_profile RPC sözleşmesi (3A). Zengin alanlar (bio/department/class_year/
// avatar_url) yalnız kamusal-rol VEYA self ise dolu; aksi halde null (DB'de
// zorlanıyor — burada EK gizleme yapma, RPC'ye güven).
type PersonProfile = {
  id: string;
  full_name: string | null;
  role: string;
  can_edit: boolean;
  bio: string | null;
  department: string | null;
  class_year: string | null;
  avatar_url: string | null;
  clubs: ProfileClub[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  // İsim broad SELECT'e açık (id, full_name, role) — başlık için yeterli.
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .maybeSingle<{ full_name: string | null }>();
  const t = await getTranslations("personProfile");
  return { title: data?.full_name ?? t("notFoundTitle") };
}

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("personProfile");
  const tRoleLabels = await getTranslations("roleLabels");
  const tMessages = await getTranslations("messages");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Rol-katmanlı, KVKK-güvenli profil — get_profile RPC (SECURITY DEFINER).
  const { data: rpcData } = await supabase.rpc("get_profile", { p_uid: id });
  const profile = rpcData as unknown as PersonProfile | null;
  if (!profile) notFound();

  const displayName = profile.full_name ?? "";
  const initials = nameInitials(displayName);

  // Avatar: RPC avatar_url'i zaten rol-katmanlı döndürür (dolu ise gösterebiliriz).
  // PRIVATE bucket → signed URL üret (event-documents deseni; public URL YOK).
  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(profile.avatar_url, 120);
    avatarUrl = signed?.signedUrl ?? null;
  }

  // Rol rozeti (etiket merkezî roleLabel'dan — D24). USER'a rozet yok
  // (profile/page.tsx deseniyle birebir).
  const roleKey = profile.role?.toString().trim().toUpperCase();
  const roleBadge =
    roleKey === "SUPER_ADMIN"
      ? { label: roleLabel(roleKey, tRoleLabels), Icon: ShieldCheck }
      : roleKey === "ADVISOR"
        ? { label: roleLabel(roleKey, tRoleLabels), Icon: GraduationCap }
        : null;

  const hasAbout = !!profile.bio || !!profile.department || !!profile.class_year;

  // Compose görünürlüğü (Aşama 4C): "kişi bir kulübün danışmanı" şartı
  // open_conversation'ın kendi şartıyla birebir — hatalı buton göstermez.
  // Bakanın süper yönetici rolü yalnız başkasının profilinde gerekir; o
  // durumda bir kez okunur. Gerçek yetki RPC + RLS'te.
  // Self'lik OTURUMDAN türetilir, RPC can_edit'inden DEĞİL: can_edit
  // (p_uid = auth.uid()) auth bağlamı REST çağrısına taşınamazsa false değil
  // SQL NULL döner; null && ... self dalını sessizce düşürürken !null admin
  // dalını ayakta bırakır (4C QA 2a asimetrisi).
  const isSelf = user.id === profile.id;
  const personIsAdvisor = profile.clubs.some((c) => c.relation === "advisor");
  let viewerIsSuperAdmin = false;
  if (personIsAdvisor && !isSelf) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    viewerIsSuperAdmin =
      viewerProfile?.role?.toString().trim().toUpperCase() === "SUPER_ADMIN";
  }

  return (
    <PageShell>
      <header className="mb-8 flex flex-wrap items-start gap-4">
        <Avatar className="size-20 shrink-0 text-lg">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_92%,transparent),color-mix(in_oklab,var(--accent-ember)_78%,transparent))] font-bold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {displayName}
          </h1>
          {roleBadge && (
            <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <roleBadge.Icon className="size-3.5" />
              {roleBadge.label}
            </span>
          )}
        </div>

        {(isSelf || (personIsAdvisor && viewerIsSuperAdmin)) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isSelf && (
              <Link
                href="/profile"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5",
                )}
              >
                <Pencil className="size-4" />
                {t("editProfile")}
              </Link>
            )}
            {/* Danışmanın yönetime proaktif yolu (self) — Aşama 4C. */}
            {isSelf && personIsAdvisor && (
              <ComposeButton
                type="ADMIN_ADVISOR"
                advisorUserId={profile.id}
                label={tMessages("compose.toAdministration")}
              />
            )}
            {/* Okul yönetimi → danışman kişi profili — Aşama 4C. */}
            {!isSelf && viewerIsSuperAdmin && personIsAdvisor && (
              <ComposeButton
                type="ADMIN_ADVISOR"
                advisorUserId={profile.id}
                label={tMessages("compose.toAdvisorPerson")}
              />
            )}
          </div>
        )}
      </header>

      {hasAbout && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {t("aboutTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {profile.bio && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {profile.bio}
              </p>
            )}
            {(profile.department || profile.class_year) && (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profile.department && (
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {t("department")}
                      </dt>
                      <dd className="truncate text-sm font-medium">
                        {profile.department}
                      </dd>
                    </div>
                  </div>
                )}
                {profile.class_year && (
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <Layers className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {t("classYear")}
                      </dt>
                      <dd className="truncate text-sm font-medium">
                        {profile.class_year}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="size-4 text-primary" />
            {t("clubsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.clubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noClubs")}</p>
          ) : (
            <ul className="space-y-2">
              {profile.clubs.map((c) => (
                <li key={c.club_id}>
                  <Link
                    href={`/clubs/${c.club_id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {c.club_name}
                    </span>
                    {c.relation === "advisor" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <GraduationCap className="size-3" />
                        {roleLabel(c.relation, tRoleLabels)}
                      </span>
                    ) : c.relation === "president" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-gold/45 bg-[color-mix(in_oklab,var(--accent-gold)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-accent-gold">
                        <Crown className="size-3" />
                        {roleLabel(c.relation, tRoleLabels)}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {roleLabel(c.relation, tRoleLabels)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

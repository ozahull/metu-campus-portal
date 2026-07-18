"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { unsubscribeFromPush } from "@/lib/push";
import { roleLabel } from "@/lib/role-label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  fullName: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  initials: string;
  avatarUrl?: string | null;
};

export function UserMenu({
  fullName,
  email,
  role,
  isSuperAdmin,
  initials,
  avatarUrl,
}: UserMenuProps) {
  const router = useRouter();
  const t = useTranslations("userMenu");
  const tNav = useTranslations("nav");
  const tRoleLabels = useTranslations("roleLabels");
  const [loading, setLoading] = useState(false);

  // Merkezî rol etiketi (D24): navbar rolü Navbar'da hesaplanır (başkanlık
  // dahil — 'PRESIDENT' olarak gelir), burada yalnız çevrilir.
  const roleText = roleLabel(role, tRoleLabels);

  async function handleSignOut() {
    setLoading(true);
    // Çıkıştan ÖNCE bu cihazın push aboneliğini iptal et + DB satırını sil
    // (silme RLS'i user_id=auth.uid() ister → oturum HÂLÂ açıkken yapılmalı).
    // Aksi halde ortak cihazda bir sonraki kullanıcıya eski kullanıcının push'ları
    // düşerdi (bildirim içeriği sızıntısı). Hata çıkışı ENGELLEMEZ: logla, devam et.
    try {
      await unsubscribeFromPush();
    } catch (err) {
      console.error("[signout] push aboneliği iptal edilemedi:", err);
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <Avatar className="size-9 border border-border">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">
              {fullName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {email}
            </span>
            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary">
              {roleText}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          render={
            <Link href="/profile" className="gap-2">
              <UserRound className="size-4" />
              {t("profile")}
            </Link>
          }
        />

        {isSuperAdmin && (
          <DropdownMenuItem
            render={
              <Link href="/admin" className="gap-2">
                <ShieldCheck className="size-4" />
                {tNav("adminPanel")}
              </Link>
            }
          />
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={loading}
          variant="destructive"
          className="gap-2"
        >
          <LogOut className="size-4" />
          {loading ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

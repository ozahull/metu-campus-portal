"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck, ShieldMinus, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export type RosterMember = {
  user_id: string;
  role: string;
  full_name: string | null;
};

export function ManageMembers({
  clubId,
  members,
  canAssignAdmin,
}: {
  clubId: string;
  members: RosterMember[];
  // Başkan (ADMIN) atama/geri alma yalnızca danışman ve okula görünür.
  canAssignAdmin: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("manage.members");
  const tc = useTranslations("confirm");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setRole(member: RosterMember, role: "ADMIN" | "MEMBER") {
    setBusyId(member.user_id);
    const supabase = createClient();
    const { error } = await supabase
      .from("club_members")
      .update({ role })
      .eq("club_id", clubId)
      .eq("user_id", member.user_id);

    setBusyId(null);
    if (error) {
      toast.error(t("toasts.roleError", { message: error.message }));
      return;
    }
    toast.success(role === "ADMIN" ? t("toasts.promoted") : t("toasts.demoted"));
    router.refresh();
  }

  async function removeMember(member: RosterMember) {
    setBusyId(member.user_id);
    const supabase = createClient();
    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", member.user_id);

    setBusyId(null);
    if (error) {
      toast.error(t("toasts.removeError", { message: error.message }));
      return;
    }
    toast.success(t("toasts.removed"));
    router.refresh();
  }

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 px-5 py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {members.map((m) => {
        const isAdmin = m.role.toUpperCase() === "ADMIN";
        const busy = busyId === m.user_id;
        return (
          <li
            key={m.user_id}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserRound className="size-4" />
              </span>
              <span className="truncate text-sm font-medium">
                {m.full_name ?? t("unnamed")}
              </span>
              {isAdmin && (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("adminBadge")}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {canAssignAdmin &&
                (isAdmin ? (
                  <Button onClick={() => setRole(m, "MEMBER")} disabled={busy} size="icon-sm" variant="ghost" aria-label={t("demoteAria")}>
                    <ShieldMinus className="size-4" />
                  </Button>
                ) : (
                  <Button onClick={() => setRole(m, "ADMIN")} disabled={busy} size="icon-sm" variant="ghost" className="hover:text-primary" aria-label={t("promoteAria")}>
                    <ShieldCheck className="size-4" />
                  </Button>
                ))}
              <ConfirmDialog
                trigger={
                  <Button disabled={busy} size="icon-sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={t("removeAria")}>
                    <UserX className="size-4" />
                  </Button>
                }
                title={tc("removeMemberTitle")}
                description={tc("removeMemberBody", {
                  name: m.full_name ?? t("unnamed"),
                })}
                confirmLabel={tc("removeMemberConfirm")}
                onConfirm={() => removeMember(m)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

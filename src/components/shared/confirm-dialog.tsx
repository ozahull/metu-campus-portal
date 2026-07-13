"use client";

import type { ReactElement, ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Geri alınamaz aksiyonlar için onay diyaloğu (başlık + açıklama + iptal/onay).
 * `trigger` mevcut butonu sarar (Base UI render prop). Onaylanınca `onConfirm`
 * çalışır — mutasyon mantığı çağıranda kalır, burası yalnızca UI onay katmanı.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = "destructive",
}: {
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "destructive" | "default";
}) {
  const t = useTranslations("confirm");
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            {cancelLabel ?? t("cancel")}
          </AlertDialogClose>
          <AlertDialogClose
            render={<Button variant={variant} />}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

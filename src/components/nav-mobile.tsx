"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { NavLinks } from "@/components/nav-links";

/**
 * Mobil gezinme: hamburger → sağdan açılan drawer. İçinde ana linkler (aktif
 * göstergeli). Bir linke tıklayınca drawer kapanır.
 */
export function NavMobile({
  showMessages = false,
  messagesUnread = 0,
}: {
  showMessages?: boolean;
  messagesUnread?: number;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("openMenu")}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-5" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[82%] flex-col gap-1 border-l border-border bg-card p-4 shadow-xl outline-none data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {t("brand")}
            </span>
            <Dialog.Close
              aria-label={t("closeMenu")}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <NavLinks
            variant="mobile"
            onNavigate={() => setOpen(false)}
            showMessages={showMessages}
            messagesUnread={messagesUnread}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

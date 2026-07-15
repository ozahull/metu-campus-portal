"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

/**
 * Dil B "Sessiz Verimlilik" yönetim navigasyonu: masaüstünde KALICI SOL SİDEBAR,
 * mobilde yatay kaydırılabilir sekme barı (360px'te kırılmaz). Base UI Tabs
 * primitive'i state yönetimini (defaultValue/uncontrolled) korur — yalnız görsel
 * kabuk sidebar'a döner. Paylaşılan Dil A `ui/tabs.tsx`'e DOKUNULMAZ (kulüp
 * detayı yatay sekmelerde kalır). Renkler surface-admin token'larından gelir.
 */
export function AdminTabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="admin-tabs"
      orientation="vertical"
      className={cn("flex flex-col gap-6 lg:flex-row lg:gap-8", className)}
      {...props}
    />
  );
}

export function AdminTabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="admin-tabs-list"
      className={cn(
        // Mobil: yatay kaydırılabilir bar (hairline alt çizgi)
        "-mx-1 flex items-center gap-1 overflow-x-auto border-b border-border px-1 [scrollbar-width:none]",
        // Masaüstü: kalıcı sol sidebar (~224px), hairline sağ çizgi
        "lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:border-r lg:px-0 lg:pr-4",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="admin-tab"
      className={cn(
        // Mobil: alt-çizgi sekme
        "inline-flex shrink-0 items-center gap-2 rounded-md border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected]:border-primary data-[selected]:text-foreground [&_svg]:size-4",
        // Masaüstü: tam genişlik sidebar öğesi; aktif = ince kırmızı sol çizgi + soluk zemin
        "lg:w-full lg:justify-start lg:rounded-md lg:border-b-0 lg:border-l-2 lg:py-2 lg:data-[selected]:bg-secondary lg:data-[selected]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTabPanel({
  className,
  ...props
}: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="admin-tab-panel"
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  );
}

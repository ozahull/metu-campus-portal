import { Skeleton } from "@/components/ui/skeleton";

/** Kulüp kartı grid iskeleti (kapak + logo + metin) — yeni ClubCard'a uyar. */
export function ClubGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="px-4">
            <Skeleton className="-mt-7 size-14 rounded-xl border-2 border-card" />
          </div>
          <div className="space-y-2 p-4 pt-2.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Etkinlik kartı grid iskeleti (tarih rozeti + başlık + meta) — EventCard'a uyar. */
export function EventGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Tek etkinlik kartı iskeleti (dashboard yatay şeridi + grid için). */
export function EventCardSkeleton() {
  return (
    <div className="h-full rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

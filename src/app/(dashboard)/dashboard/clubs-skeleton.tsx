import { Skeleton } from "@/components/ui/skeleton";

/** Kulüpler yüklenirken gösterilen skeleton ızgarası (yeni kart iskeletine uyar). */
export function ClubsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
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

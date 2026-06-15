import { Skeleton } from "@/components/ui/skeleton";

/** Kulüpler yüklenirken gösterilen skeleton ızgarası. */
export function ClubsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/5 bg-zinc-900/50 p-6"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg bg-white/5" />
            <Skeleton className="h-5 w-32 bg-white/5" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full bg-white/5" />
            <Skeleton className="h-3 w-5/6 bg-white/5" />
            <Skeleton className="h-3 w-2/3 bg-white/5" />
          </div>
          <Skeleton className="mt-6 h-9 w-full bg-white/5" />
        </div>
      ))}
    </div>
  );
}

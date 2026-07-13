import { PageShell } from "@/components/shared/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClubGridSkeleton,
  EventCardSkeleton,
} from "@/components/shared/skeletons";

export default function DashboardLoading() {
  return (
    <PageShell>
      {/* Hero + istatistik */}
      <div className="mb-10">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
          <Skeleton className="h-[74px] rounded-xl" />
          <Skeleton className="h-[74px] rounded-xl" />
        </div>
      </div>

      {/* Etkinlik şeridi */}
      <Skeleton className="mb-5 h-7 w-64" />
      <div className="mb-12 flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 sm:w-80">
            <EventCardSkeleton />
          </div>
        ))}
      </div>

      {/* Kulüpler */}
      <Skeleton className="mb-5 h-7 w-40" />
      <ClubGridSkeleton count={6} />
    </PageShell>
  );
}

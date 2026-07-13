import { PageShell } from "@/components/shared/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { EventGridSkeleton } from "@/components/shared/skeletons";

export default function EventsLoading() {
  return (
    <PageShell>
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg sm:w-40" />
        <Skeleton className="h-11 w-full rounded-lg sm:w-40" />
      </div>
      <EventGridSkeleton count={9} />
    </PageShell>
  );
}

import { PageShell } from "@/components/shared/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubGridSkeleton } from "@/components/shared/skeletons";

export default function ClubsLoading() {
  return (
    <PageShell>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-11 w-full max-w-xl rounded-lg" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <ClubGridSkeleton count={9} />
      </div>
    </PageShell>
  );
}

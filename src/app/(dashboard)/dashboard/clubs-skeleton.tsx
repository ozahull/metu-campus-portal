import { ClubGridSkeleton } from "@/components/shared/skeletons";

/** Kulüpler yüklenirken gösterilen skeleton ızgarası (Suspense fallback). */
export function ClubsSkeleton() {
  return <ClubGridSkeleton count={6} />;
}

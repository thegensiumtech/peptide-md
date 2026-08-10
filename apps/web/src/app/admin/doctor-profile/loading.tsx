import {
  Skeleton,
  SkeletonRegion,
  SkeletonSlots,
  SkeletonTable,
  SkeletonTiles,
} from '@/components/ui/Skeleton';

/** Shown while the server component fetches. Shaped like the real screen. */
export default function Loading() {
  return (
    <SkeletonRegion label="Loading the profile" className="px-5 py-8 sm:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
      <div className="mt-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <Skeleton className="aspect-[4/5] rounded-lg" />
      </div>
      </div>
    </SkeletonRegion>
  );
}

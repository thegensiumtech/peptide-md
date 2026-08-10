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
    <SkeletonRegion label="Loading bookings" className="px-5 py-8 sm:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
      <div className="mt-8">
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-40" />
          ))}
        </div>
      </div>
      <div className="mt-6">
        <SkeletonTable rows={8} columns={6} />
      </div>
      </div>
    </SkeletonRegion>
  );
}

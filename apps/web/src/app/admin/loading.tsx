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
    <SkeletonRegion label="Loading the dashboard" className="px-5 py-8 sm:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
      <div className="mt-8">
      <SkeletonTiles />
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SkeletonTable rows={6} columns={3} />
        <div className="rounded-lg border border-line bg-surface p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      </div>
      </div>
    </SkeletonRegion>
  );
}

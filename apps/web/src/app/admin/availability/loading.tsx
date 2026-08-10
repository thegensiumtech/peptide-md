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
    <SkeletonRegion label="Loading your diary" className="px-5 py-8 sm:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
      <div className="mt-8">
      <div className="rounded-lg border border-line bg-surface p-5">
        <Skeleton className="h-3 w-24" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <Skeleton className="h-3 w-20" />
              <div className="mt-4">
                <SkeletonSlots count={9} />
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </SkeletonRegion>
  );
}

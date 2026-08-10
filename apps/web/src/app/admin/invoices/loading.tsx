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
    <SkeletonRegion label="Loading invoices" className="px-5 py-8 sm:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
      <div className="mt-8">
      <SkeletonTable rows={2} columns={6} />
      <div className="mt-10">
        <SkeletonTable rows={4} columns={7} />
      </div>
      </div>
    </SkeletonRegion>
  );
}

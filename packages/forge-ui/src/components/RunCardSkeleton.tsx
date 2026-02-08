/**
 * RunCardSkeleton - Loading skeleton for RunCard
 *
 * Displays animated placeholder while runs are loading.
 */

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface RunCardSkeletonProps {
  className?: string;
}

export function RunCardSkeleton({ className }: RunCardSkeletonProps) {
  return (
    <div
      className={cn(
        'relative block bg-bg-card border border-border-subtle rounded-xl pl-5 pr-4 py-4',
        className
      )}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-border-subtle" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Plan goal skeleton */}
          <Skeleton className="h-5 w-3/4 mb-3" />

          {/* Progress bar skeleton */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>

          {/* Metadata skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status badge skeleton */}
          <Skeleton className="h-6 w-20 rounded-md" />
          {/* Chevron skeleton */}
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

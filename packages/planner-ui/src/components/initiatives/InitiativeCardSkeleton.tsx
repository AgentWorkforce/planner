interface InitiativeCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton loading component for InitiativeCard.
 * Matches the card layout: icon, name, description, status badge, plan counts.
 *
 * Usage:
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *   {isLoading && Array.from({ length: 6 }).map((_, i) => (
 *     <InitiativeCardSkeleton key={i} />
 *   ))}
 * </div>
 */
export function InitiativeCardSkeleton({ className = '' }: InitiativeCardSkeletonProps) {
  return (
    <div
      className={`bg-bg-card border border-border-subtle rounded-xl p-4 ${className}`}
    >
      <div className="space-y-3">
        {/* Header: icon + name */}
        <div className="flex items-center gap-3">
          {/* Icon placeholder (32x32 circle) */}
          <div className="w-8 h-8 bg-bg-tertiary rounded animate-pulse flex-shrink-0" />
          {/* Name placeholder */}
          <div className="h-4 w-32 bg-bg-tertiary rounded animate-pulse" />
        </div>

        {/* Description placeholder (2 lines) */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-bg-tertiary rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-bg-tertiary rounded animate-pulse" />
        </div>

        {/* Bottom row: status badge + plan counts */}
        <div className="flex items-center justify-between pt-1">
          {/* Status badge placeholder */}
          <div className="h-5 w-16 bg-bg-tertiary rounded animate-pulse" />

          {/* Plan counts placeholder (4 small items) */}
          <div className="flex items-center gap-3">
            <div className="h-3 w-8 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-3 w-8 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-3 w-8 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-3 w-8 bg-bg-tertiary rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

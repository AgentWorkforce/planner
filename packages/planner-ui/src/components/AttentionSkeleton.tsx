interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton for CollapsibleSection header.
 * Matches the header dimensions: title, count badge, and chevron.
 */
export function SectionSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 bg-bg-card border border-border-subtle rounded-lg ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Title skeleton */}
        <div className="h-6 w-32 bg-bg-tertiary rounded animate-pulse" />
        {/* Count badge skeleton */}
        <div className="h-5 w-8 bg-bg-tertiary rounded-full animate-pulse" />
      </div>
      {/* Chevron skeleton */}
      <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
    </div>
  );
}

/**
 * Skeleton for AttentionItem card.
 * Matches card dimensions: goal, metadata, badge, and time context.
 */
export function AttentionItemSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-bg-card border border-border-subtle border-l-4 border-l-bg-tertiary rounded-xl p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Goal and metadata */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Goal skeleton */}
          <div className="h-5 w-48 bg-bg-tertiary rounded animate-pulse" />
          {/* Metadata skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
          </div>
        </div>

        {/* Right: Badge and time */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex flex-col items-end gap-1">
            {/* Badge skeleton */}
            <div className="h-6 w-6 bg-bg-tertiary rounded animate-pulse" />
            {/* Time skeleton */}
            <div className="h-3 w-16 bg-bg-tertiary rounded animate-pulse" />
          </div>
          {/* Chevron skeleton */}
          <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for plan card in All Plans section.
 * Matches existing plan card dimensions.
 */
export function PlanCardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-bg-card border border-border-subtle border-l-4 border-l-bg-tertiary rounded-xl p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title skeleton */}
          <div className="h-5 w-56 bg-bg-tertiary rounded animate-pulse" />
          {/* Metadata skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-4 w-12 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-4 w-20 bg-bg-tertiary rounded animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status badge skeleton */}
          <div className="h-6 w-16 bg-bg-tertiary rounded-md animate-pulse" />
          {/* Chevron skeleton */}
          <div className="h-4 w-4 bg-bg-tertiary rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full loading skeleton for the PlansListPage.
 * Shows expected structure: Needs Attention, Working On, All Plans.
 */
export function PlansListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Needs Attention section skeleton */}
      <div>
        <SectionSkeleton />
        <div className="pt-3 space-y-2">
          <AttentionItemSkeleton />
          <AttentionItemSkeleton />
        </div>
      </div>

      {/* Working On section skeleton */}
      <div>
        <SectionSkeleton />
        <div className="pt-3">
          <AttentionItemSkeleton />
        </div>
      </div>

      {/* All Plans section skeleton */}
      <div>
        <SectionSkeleton />
        <div className="pt-3 space-y-3">
          {/* Filter tabs skeleton */}
          <div className="flex gap-1 mb-4">
            <div className="h-8 w-12 bg-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-8 w-14 bg-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-bg-tertiary rounded-lg animate-pulse" />
          </div>
          <PlanCardSkeleton />
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </div>
      </div>
    </div>
  );
}

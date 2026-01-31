import { DocumentIcon } from '@/components/icons';

/**
 * Empty state for Decision Log when no decisions are available.
 *
 * Design spec:
 * - Layout: flex flex-col items-center justify-center py-12 text-center
 * - Icon: w-12 h-12 text-text-muted mb-4 (DocumentIcon as clipboard)
 * - Title: text-lg font-medium text-text-primary
 * - Subtitle: text-sm text-text-muted
 *
 * Usage:
 * ```tsx
 * {decisions.length === 0 && <DecisionEmptyState />}
 * ```
 */
export function DecisionEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Icon - using DocumentIcon as clipboard representation */}
      <DocumentIcon size="xl" className="w-12 h-12 text-text-muted mb-4" />

      {/* Title */}
      <p className="text-lg font-medium text-text-primary">No decisions yet</p>

      {/* Subtitle */}
      <p className="text-sm text-text-muted">Decisions you make will appear here</p>
    </div>
  );
}

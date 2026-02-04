import { cn } from '@/lib/utils';

/**
 * Props for IdeaSummarySection component
 */
export interface IdeaSummarySectionProps {
  summary: string;
  className?: string;
}

/**
 * IdeaSummarySection
 *
 * Displays the AI-synthesized idea summary as a styled quote/callout.
 * Used in the AI Understanding drawer and potentially in other views.
 *
 * Visual design:
 * - Left accent border (primary color)
 * - Italic quote styling
 * - Subtle background for visual distinction
 *
 * @example
 * ```tsx
 * <IdeaSummarySection
 *   summary="Building a task management system with real-time collaboration..."
 * />
 * ```
 */
export function IdeaSummarySection({ summary, className }: IdeaSummarySectionProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className={cn('', className)}>
      <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
        Idea Summary
      </h3>
      <blockquote
        className={cn(
          'p-4 rounded-lg',
          'bg-bg-card border-l-4 border-primary',
          'text-sm text-text-secondary leading-relaxed italic',
        )}
      >
        {summary}
      </blockquote>
    </section>
  );
}

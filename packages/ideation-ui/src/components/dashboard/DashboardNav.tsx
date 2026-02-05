import { cn } from '@/lib/utils';

export interface DashboardNavProps {
  className?: string;
}

/**
 * DashboardNav
 *
 * Simple nav component for the dashboard's center-top (N) grid area.
 * Displays the page title with canvas-themed styling.
 */
export function DashboardNav({ className }: DashboardNavProps) {
  return (
    <div className={cn('flex items-center px-4 py-3', className)}>
      <h1 className="text-lg font-semibold text-[var(--canvas-text-primary)]">
        Ideation Dashboard
      </h1>
    </div>
  );
}

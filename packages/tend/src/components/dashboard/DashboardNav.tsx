import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export interface DashboardNavProps {
  className?: string;
}

/**
 * DashboardNav
 *
 * Simple nav component for the dashboard's center-top (N) grid area.
 * Displays the page title with canvas-themed styling and theme toggle.
 */
export function DashboardNav({ className }: DashboardNavProps) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-3', className)}>
      <h1 className="text-lg font-semibold text-[var(--canvas-text-primary)]">
        Tend Dashboard
      </h1>
      <ThemeToggle />
    </div>
  );
}

/**
 * Pagination - Pagination controls for list views
 *
 * Displays page navigation with "Showing X-Y of Z" info.
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-2 py-4',
        className
      )}
    >
      {/* Item count */}
      <p className="text-sm text-text-secondary">
        Showing <span className="font-medium text-text-primary">{startItem}</span>
        {' - '}
        <span className="font-medium text-text-primary">{endItem}</span>
        {' of '}
        <span className="font-medium text-text-primary">{totalItems}</span>
      </p>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeftIcon />
          Previous
        </Button>

        {/* Page indicators */}
        <div className="flex items-center gap-1">
          {getPageNumbers(currentPage, totalPages).map((pageNum, idx) =>
            pageNum === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-text-muted"
              >
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum as number)}
                className={cn(
                  'min-w-[32px] h-8 px-2 rounded-md text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan',
                  currentPage === pageNum
                    ? 'bg-accent-cyan text-bg-deep'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                )}
              >
                {pageNum}
              </button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * Get array of page numbers to display with ellipsis.
 */
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push('ellipsis');
  }

  // Show pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('ellipsis');
  }

  // Always show last page
  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

function ChevronLeftIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

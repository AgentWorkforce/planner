import { useMemo } from "react";
import { cn } from "../utils/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

export interface PaginationProps {
  /** Current active page (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Maximum number of page buttons to show (default: 5) */
  maxVisiblePages?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pagination component with page numbers and navigation arrows.
 * Shows ellipsis when there are too many pages to display.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  className,
}: PaginationProps) {
  const pages = useMemo(() => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    const result: (number | "ellipsis-start" | "ellipsis-end")[] = [];

    if (start > 1) {
      result.push(1);
      if (start > 2) {
        result.push("ellipsis-start");
      }
    }

    for (let i = start; i <= end; i++) {
      result.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        result.push("ellipsis-end");
      }
      result.push(totalPages);
    }

    return result;
  }, [currentPage, totalPages, maxVisiblePages]);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      {/* Previous button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-2 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeftIcon size={16} />
      </button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page) => {
          if (page === "ellipsis-start" || page === "ellipsis-end") {
            return (
              <span key={page} className="px-2 py-1 text-sm text-muted-foreground">
                ...
              </span>
            );
          }

          const isActive = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "min-w-[32px] px-2 py-1.5 text-sm rounded-md border transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              aria-label={`Page ${page}`}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-2 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        <ChevronRightIcon size={16} />
      </button>
    </nav>
  );
}

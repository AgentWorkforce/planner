/**
 * PRStatusBadge - Badge component for PR status display
 *
 * Features:
 * - Status-based styling: open (green outline), merged (purple fill), closed (red)
 * - Stale indicator with tooltip after 5 minutes
 * - Optional refresh button on hover when stale
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PRStatus } from '@/types';

interface PRStatusBadgeProps {
  status: PRStatus;
  lastChecked?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate if the last check is stale
 */
function isStale(lastChecked?: string): boolean {
  if (!lastChecked) return false;
  const lastCheckedTime = new Date(lastChecked).getTime();
  const now = Date.now();
  return now - lastCheckedTime > STALE_THRESHOLD_MS;
}

/**
 * Format relative time for staleness indicator
 */
function formatRelativeTime(lastChecked?: string): string {
  if (!lastChecked) return 'Never checked';

  const lastCheckedTime = new Date(lastChecked).getTime();
  const now = Date.now();
  const diffMs = now - lastCheckedTime;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `Last checked ${hours}h ago`;
  }
  if (minutes > 0) {
    return `Last checked ${minutes}m ago`;
  }
  return 'Just checked';
}

/**
 * Get status display label
 */
function getStatusLabel(status: PRStatus): string {
  const labels: Record<PRStatus, string> = {
    open: 'Open',
    merged: 'Merged',
    closed: 'Closed',
  };
  return labels[status] || status;
}

/**
 * Get status-based styling
 */
function getStatusClasses(status: PRStatus): string {
  switch (status) {
    case 'open':
      return 'border border-success text-success bg-transparent';
    case 'merged':
      return 'bg-accent-purple text-white border-transparent';
    case 'closed':
      return 'bg-error text-white border-transparent';
    default:
      return 'border border-border-subtle text-text-muted bg-transparent';
  }
}

/**
 * Refresh icon component
 */
function RefreshIcon({ className, isSpinning }: { className?: string; isSpinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className, isSpinning && 'animate-spin')}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

/**
 * Warning icon for stale indicator
 */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function PRStatusBadge({
  status,
  lastChecked,
  onRefresh,
  isRefreshing = false,
  className,
}: PRStatusBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const stale = isStale(lastChecked);
  const canRefresh = onRefresh && stale && !isRefreshing;

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
          getStatusClasses(status)
        )}
      >
        {getStatusLabel(status)}
      </span>

      {/* Stale indicator */}
      {stale && !isHovered && (
        <span
          className="inline-flex items-center gap-1 text-text-muted"
          title={formatRelativeTime(lastChecked)}
        >
          <WarningIcon className="h-3 w-3 text-warning" />
        </span>
      )}

      {/* Refresh button on hover when stale */}
      {canRefresh && isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className="p-0.5 rounded hover:bg-bg-hover transition-colors"
          title={formatRelativeTime(lastChecked)}
        >
          <RefreshIcon className="h-3 w-3 text-text-muted hover:text-text-secondary" />
        </button>
      )}

      {/* Refreshing spinner */}
      {isRefreshing && (
        <RefreshIcon className="h-3 w-3 text-accent-cyan" isSpinning />
      )}
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function PRStatusBadgeCompact({
  status,
  className,
}: {
  status: PRStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
        getStatusClasses(status),
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

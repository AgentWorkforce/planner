/**
 * PreflightChecklist - Container for all preflight checks
 *
 * Shows header, list of checks, and overall status summary.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PreflightCheckItem } from './PreflightCheckItem';
import type { PreflightCheck } from '@/types';

interface PreflightChecklistProps {
  checks: PreflightCheck[];
  isLoading?: boolean;
  className?: string;
}

/**
 * Chevron Icon for expand/collapse
 */
function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'h-4 w-4 transition-transform duration-200',
        expanded && 'rotate-180',
        className
      )}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function PreflightChecklist({
  checks,
  isLoading,
  className,
}: PreflightChecklistProps) {
  const [showDetails, setShowDetails] = useState(true);

  // Calculate summary
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const pendingCount = checks.filter((c) => c.status === 'pending').length;

  const allPassed = failCount === 0 && pendingCount === 0;
  const hasIssues = failCount > 0 || warningCount > 0;

  // Get overall status message
  const getStatusMessage = () => {
    if (isLoading || pendingCount > 0) {
      return 'Running checks...';
    }
    if (failCount > 0) {
      return `${failCount} check${failCount > 1 ? 's' : ''} failed`;
    }
    if (warningCount > 0) {
      return `All checks passed with ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
    }
    return 'All checks passed';
  };

  // Get status color
  const getStatusColor = () => {
    if (isLoading || pendingCount > 0) {
      return 'text-text-muted';
    }
    if (failCount > 0) {
      return 'text-red-500';
    }
    if (warningCount > 0) {
      return 'text-amber-500';
    }
    return 'text-green-500';
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-surface',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <div className="flex items-center gap-3">
          {/* Checklist Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-text-muted"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          <h3 className="font-semibold text-text-primary">Pre-Flight Checks</h3>
        </div>

        {/* Expand/Collapse Button */}
        {hasIssues && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {showDetails ? 'Hide' : 'Show'} details
            <ChevronIcon expanded={showDetails} />
          </button>
        )}
      </div>

      {/* Status Summary */}
      <div className="border-b border-border-subtle px-4 py-3">
        <div className={cn('flex items-center gap-2 font-medium', getStatusColor())}>
          {isLoading ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : allPassed ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : failCount > 0 ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          <span>{getStatusMessage()}</span>
        </div>

        {/* Pass/Fail/Warning counts */}
        {!isLoading && checks.length > 0 && (
          <div className="mt-2 flex gap-4 text-sm text-text-muted">
            <span className="text-green-500">{passCount} passed</span>
            {failCount > 0 && <span className="text-red-500">{failCount} failed</span>}
            {warningCount > 0 && <span className="text-amber-500">{warningCount} warnings</span>}
          </div>
        )}
      </div>

      {/* Check List */}
      {showDetails && (
        <div className="divide-y divide-border-subtle">
          {checks.map((check) => (
            <PreflightCheckItem key={check.id} check={check} />
          ))}
        </div>
      )}

      {/* Collapsed View - Show only failed/warning */}
      {!showDetails && hasIssues && (
        <div className="divide-y divide-border-subtle">
          {checks
            .filter((c) => c.status === 'fail' || c.status === 'warning')
            .map((check) => (
              <PreflightCheckItem key={check.id} check={check} />
            ))}
        </div>
      )}
    </div>
  );
}

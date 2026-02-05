/**
 * PreflightCheckItem - Individual preflight check display
 *
 * Shows status icon, check name, and message for failed/warning checks.
 */

import { cn } from '@/lib/utils';
import type { PreflightCheck } from '@/types';

interface PreflightCheckItemProps {
  check: PreflightCheck;
  className?: string;
}

/**
 * Check Circle Icon - Pass status
 */
function CheckCircleIcon({ className }: { className?: string }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/**
 * X Circle Icon - Fail status
 */
function XCircleIcon({ className }: { className?: string }) {
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
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

/**
 * Alert Triangle Icon - Warning status
 */
function AlertTriangleIcon({ className }: { className?: string }) {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Loading Spinner Icon - Pending status
 */
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('animate-spin', className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * Get icon component and color for status
 */
function getStatusIcon(status: PreflightCheck['status']) {
  switch (status) {
    case 'pass':
      return {
        Icon: CheckCircleIcon,
        className: 'h-5 w-5 text-green-500',
      };
    case 'fail':
      return {
        Icon: XCircleIcon,
        className: 'h-5 w-5 text-red-500',
      };
    case 'warning':
      return {
        Icon: AlertTriangleIcon,
        className: 'h-5 w-5 text-amber-500',
      };
    case 'pending':
    default:
      return {
        Icon: SpinnerIcon,
        className: 'h-5 w-5 text-text-muted',
      };
  }
}

export function PreflightCheckItem({ check, className }: PreflightCheckItemProps) {
  const { Icon, className: iconClassName } = getStatusIcon(check.status);
  const showMessage = check.message && (check.status === 'fail' || check.status === 'warning');

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md p-3 transition-colors',
        check.status === 'fail' && 'bg-red-500/5',
        check.status === 'warning' && 'bg-amber-500/5',
        className
      )}
    >
      {/* Status Icon */}
      <Icon className={iconClassName} />

      {/* Check Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text-primary">{check.name}</div>
        {showMessage && (
          <div
            className={cn(
              'mt-1 text-sm',
              check.status === 'fail' && 'text-red-400',
              check.status === 'warning' && 'text-amber-400'
            )}
          >
            {check.message}
          </div>
        )}
        {check.status === 'pass' && check.message && (
          <div className="mt-1 text-sm text-text-muted">{check.message}</div>
        )}
      </div>
    </div>
  );
}

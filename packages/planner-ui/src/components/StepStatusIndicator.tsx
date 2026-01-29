import type { StepExecutionStatus } from '@/types';
import { CheckIcon, AlertIcon, CloseIcon } from './icons';

interface StepStatusIndicatorProps {
  status: StepExecutionStatus;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Visual indicator for step execution status.
 * Shows different icons and colors for each status.
 */
export function StepStatusIndicator({ status, size = 'md' }: StepStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-6 h-6 text-sm',
    lg: 'w-8 h-8 text-base',
  };

  const baseClasses = `inline-flex items-center justify-center rounded-full ${sizeClasses[size]}`;

  switch (status) {
    case 'done':
      return (
        <span
          className={`${baseClasses} bg-success/10 text-success`}
          title="Completed"
          aria-label="Step completed"
        >
          <CheckIcon size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      );

    case 'running':
      return (
        <span
          className={`${baseClasses} bg-accent-cyan/10 text-accent-cyan`}
          title="Running"
          aria-label="Step running"
        >
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </span>
      );

    case 'pending':
      return (
        <span
          className={`${baseClasses} bg-bg-tertiary text-text-muted`}
          title="Pending"
          aria-label="Step pending"
        >
          <span className="w-2 h-2 border-2 border-current rounded-full" />
        </span>
      );

    case 'blocked':
      return (
        <span
          className={`${baseClasses} bg-warning/10 text-warning`}
          title="Blocked"
          aria-label="Step blocked"
        >
          <AlertIcon size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      );

    case 'failed':
      return (
        <span
          className={`${baseClasses} bg-error/10 text-error`}
          title="Failed"
          aria-label="Step failed"
        >
          <CloseIcon size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      );

    default:
      return null;
  }
}

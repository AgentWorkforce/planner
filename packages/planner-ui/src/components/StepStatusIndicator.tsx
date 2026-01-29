import type { StepExecutionStatus } from '@/types';

interface StepStatusIndicatorProps {
  status: StepExecutionStatus;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Visual indicator for step execution status.
 * Shows different icons and colors for each status.
 */
export function StepStatusIndicator({ status, size = 'md' }: StepStatusIndicatorProps) {
  const sizeClass = `step-status-indicator--${size}`;

  switch (status) {
    case 'done':
      return (
        <span
          className={`step-status-indicator step-status-done ${sizeClass}`}
          title="Completed"
          aria-label="Step completed"
        >
          <span className="status-icon">✓</span>
        </span>
      );

    case 'running':
      return (
        <span
          className={`step-status-indicator step-status-running ${sizeClass}`}
          title="Running"
          aria-label="Step running"
        >
          <span className="status-icon status-spinner">⟳</span>
        </span>
      );

    case 'pending':
      return (
        <span
          className={`step-status-indicator step-status-pending ${sizeClass}`}
          title="Pending"
          aria-label="Step pending"
        >
          <span className="status-icon">○</span>
        </span>
      );

    case 'blocked':
      return (
        <span
          className={`step-status-indicator step-status-blocked ${sizeClass}`}
          title="Blocked"
          aria-label="Step blocked"
        >
          <span className="status-icon">⚠</span>
        </span>
      );

    case 'failed':
      return (
        <span
          className={`step-status-indicator step-status-failed ${sizeClass}`}
          title="Failed"
          aria-label="Step failed"
        >
          <span className="status-icon">✕</span>
        </span>
      );

    default:
      return null;
  }
}

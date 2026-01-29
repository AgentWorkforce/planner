import type { AttentionType } from '@/types';
import { getAttentionLabel, getAttentionColor } from '@/utils/attention';
import {
  AlertIcon,
  ClockIcon,
  RefreshIcon,
  GateIcon,
  PlayIcon,
  MessageIcon,
  CheckIcon,
} from '@/components/icons';

interface AttentionBadgeProps {
  type: AttentionType;
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Get the icon component for an attention type.
 */
function getAttentionIcon(type: AttentionType) {
  switch (type) {
    case 'execution_failed':
      return AlertIcon;
    case 'change_request':
      return RefreshIcon;
    case 'gate_pending':
      return GateIcon;
    case 'awaiting_approval':
      return ClockIcon;
    case 'stale_draft':
      return ClockIcon;
    case 'active':
      return PlayIcon;
    case 'unread_comments':
      return MessageIcon;
    case 'none':
      return CheckIcon;
  }
}

/**
 * Get Tailwind classes for badge background and text based on attention type.
 */
function getBadgeClasses(type: AttentionType): string {
  const color = getAttentionColor(type);

  // execution_failed gets special glow effect
  if (type === 'execution_failed') {
    return `bg-error/10 text-error shadow-[0_0_12px_rgba(255,71,87,0.4)]`;
  }

  // Map color names to Tailwind classes
  switch (color) {
    case 'warning':
      return 'bg-warning/10 text-warning';
    case 'error':
      return 'bg-error/10 text-error';
    case 'accent-purple':
      return 'bg-accent-purple/10 text-accent-purple';
    case 'accent-cyan':
      return 'bg-accent-cyan/10 text-accent-cyan';
    case 'accent-blue':
      return 'bg-accent-blue/10 text-accent-blue';
    case 'success':
      return 'bg-success/10 text-success';
    case 'text-muted':
      return 'bg-bg-tertiary text-text-muted';
    case 'text-dim':
      return 'bg-bg-tertiary text-text-dim';
    default:
      return 'bg-bg-tertiary text-text-secondary';
  }
}

/**
 * Badge component displaying an attention type with icon and optional label.
 *
 * - compact: icon only (16px)
 * - full: icon + human-readable label
 */
export function AttentionBadge({
  type,
  variant = 'full',
  className = '',
}: AttentionBadgeProps) {
  const Icon = getAttentionIcon(type);
  const label = getAttentionLabel(type);
  const colorClasses = getBadgeClasses(type);

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center justify-center p-1 rounded ${colorClasses} ${className}`}
        title={label}
      >
        <Icon size="sm" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${colorClasses} ${className}`}
    >
      <Icon size="sm" />
      <span>{label}</span>
    </span>
  );
}

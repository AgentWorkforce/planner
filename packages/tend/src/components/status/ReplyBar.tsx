import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface PendingItem {
  id: string;
  type: 'question' | 'gate' | 'decision';
  content: string;
  source: string; // agent name or step title
  priority: 'blocking' | 'normal' | 'fyi';
  created_at: string;
}

export interface ReplyBarProps {
  items: PendingItem[];
  onReply: (itemId: string) => void;
  onDismiss: (itemId: string) => void;
  onNavigate?: (itemId: string) => void;
}

/**
 * Format a date string to relative time (e.g., "2m ago", "1h ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/**
 * ReplyBar - Notification bar for pending questions, approval gates, and decisions
 *
 * Appears above the StatusBar when there are items needing user attention.
 * Shows the highest-priority item first, with controls to reply, dismiss, or navigate.
 */
export function ReplyBar({ items, onReply, onDismiss, onNavigate }: ReplyBarProps) {
  // Don't render if no items
  if (items.length === 0) {
    return null;
  }

  // Sort by priority (blocking > normal > fyi)
  const sortedItems = [...items].sort((a, b) => {
    const priorityOrder = { blocking: 0, normal: 1, fyi: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const currentItem = sortedItems[0]!; // Safe because we checked items.length > 0
  const remainingCount = sortedItems.length - 1;

  // Type icons
  const typeIcon = {
    question: '?',
    gate: '🛡️',
    decision: '⚖️',
  };

  // Priority border colors
  const priorityBorderClass = {
    blocking: 'border-l-4 border-l-accent-secondary',
    normal: 'border-l-4 border-l-accent-primary',
    fyi: 'border-l-4 border-l-border-subtle',
  };

  return (
    <div
      className={cn(
        'bg-bg-secondary border-t border-border-default',
        'flex items-center px-4 py-2 gap-3',
        priorityBorderClass[currentItem.priority]
      )}
    >
      {/* Type icon */}
      <div
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
          'bg-bg-tertiary text-text-primary text-sm font-semibold'
        )}
      >
        {typeIcon[currentItem.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{currentItem.content}</p>
      </div>

      {/* Relative time */}
      <span className="text-xs text-text-muted shrink-0">
        {formatRelativeTime(currentItem.created_at)}
      </span>

      {/* Source badge */}
      <div className="shrink-0">
        <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">
          {currentItem.source}
        </span>
      </div>

      {/* Remaining count */}
      {remainingCount > 0 && (
        <span className="text-xs text-text-muted shrink-0">
          {remainingCount} more
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onNavigate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(currentItem.id)}
            className="text-xs"
          >
            View
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => onReply(currentItem.id)}
          className="text-xs"
        >
          Reply
        </Button>
        <button
          onClick={() => onDismiss(currentItem.id)}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

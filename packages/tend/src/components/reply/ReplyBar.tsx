/**
 * ReplyBar Component
 *
 * A compact floating bar positioned between ConversationMessages and ConversationInput.
 * Shows pending items that need user attention (questions, approvals, reviews).
 *
 * Features:
 * - Shows up to 3 items, "+N more" if overflow
 * - Each item displays: agent role icon, preview text, time ago, priority indicator
 * - Click navigates to context (agent tab, tree node, or message)
 * - Hidden when no items (returns null)
 * - Fade in/out transition
 * - Earth-tone colors: high priority = brick, medium = clay, low = subtle
 */

import { formatDistanceToNow } from '@/lib/utils';
import type { ReplyItem } from '@/hooks/useQuestionQueue';
import { User, CheckCircle, Eye } from 'lucide-react';

interface ReplyBarProps {
  /** Pending items to display */
  items: ReplyItem[];
  /** Callback when an item is clicked */
  onItemClick: (itemId: string) => void;
}

/**
 * Get priority border color class
 */
function getPriorityBorder(priority: ReplyItem['priority']): string {
  switch (priority) {
    case 'high':
      return 'border-l-[var(--color-brick)]';
    case 'medium':
      return 'border-l-[var(--color-clay)]';
    case 'low':
      return 'border-l-border-subtle';
  }
}

/**
 * Get icon for item type
 */
function getTypeIcon(type: ReplyItem['type']): React.ReactNode {
  switch (type) {
    case 'question':
      return <User className="w-3 h-3" />;
    case 'approval':
      return <CheckCircle className="w-3 h-3" />;
    case 'review':
      return <Eye className="w-3 h-3" />;
  }
}

/**
 * Format time ago
 */
function formatTimeAgo(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'just now';
  }
}

/**
 * ReplyBar item component
 */
function ReplyBarItem({ item, onClick }: { item: ReplyItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2
        bg-bg-card border-l-2 ${getPriorityBorder(item.priority)}
        hover:bg-bg-hover transition-colors
        text-left w-full
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0 text-text-muted">
        {getTypeIcon(item.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {item.agentRole && (
            <span className="text-xs font-medium text-text-secondary">
              {item.agentRole}
            </span>
          )}
          <span className="text-xs text-text-dim">
            {formatTimeAgo(item.timestamp)}
          </span>
        </div>
        <p className="text-sm text-text-primary truncate">
          {item.preview}
        </p>
      </div>
    </button>
  );
}

/**
 * ReplyBar component
 */
export function ReplyBar({ items, onItemClick }: ReplyBarProps) {
  // Hidden when no items
  if (items.length === 0) {
    return null;
  }

  // Show max 3 items
  const visibleItems = items.slice(0, 3);
  const overflowCount = Math.max(0, items.length - 3);

  return (
    <div className="
      border-t border-border-subtle
      bg-bg-secondary/50
      transition-opacity duration-200
      animate-fadeIn
    ">
      {/* Items */}
      <div className="divide-y divide-border-subtle">
        {visibleItems.map(item => (
          <ReplyBarItem
            key={item.id}
            item={item}
            onClick={() => onItemClick(item.id)}
          />
        ))}
      </div>

      {/* Overflow indicator */}
      {overflowCount > 0 && (
        <div className="px-3 py-1.5 text-xs text-text-muted text-center bg-bg-tertiary/30">
          +{overflowCount} more pending
        </div>
      )}
    </div>
  );
}

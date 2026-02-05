/**
 * MessageBubble Component
 *
 * Displays a single message with avatar, sender info, and content.
 * Supports user/agent color coding and markdown-like formatting.
 */

import { cn } from '../../utils/cn';
import { Avatar } from '../Avatar';
import type { MessageBubbleProps as BaseProps } from '../../types/messaging';

export interface MessageBubbleProps extends BaseProps {
  /** Whether to show timestamp (default: true when showAvatar is true) */
  showTimestamp?: boolean;
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Process inline code formatting
 */
function processInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 bg-[var(--color-bg-secondary,#12121c)] rounded text-xs font-mono text-[var(--color-accent-cyan,#00d9ff)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Message content with markdown-like formatting
 */
function MessageContent({ content }: { content: string }) {
  // Handle code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
          return (
            <pre
              key={index}
              className="my-2 p-2 bg-[var(--color-bg-secondary,#12121c)] rounded text-xs overflow-x-auto font-mono"
            >
              <code>{code}</code>
            </pre>
          );
        }
        return <span key={index}>{processInlineFormatting(part)}</span>;
      })}
    </div>
  );
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showTimestamp,
  className,
}: MessageBubbleProps) {
  const displayName = message.fromName || message.from || 'Unknown';
  const shouldShowTimestamp = showTimestamp ?? showAvatar;

  return (
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse', className)}>
      {/* Avatar column */}
      {showAvatar && !isOwn && (
        <Avatar
          name={displayName}
          entityType={message.entityType}
          size="sm"
        />
      )}
      {!showAvatar && !isOwn && <div className="w-8" />}

      {/* Content column */}
      <div className={cn('flex-1 max-w-[85%]', isOwn ? 'ml-5' : 'mr-5')}>
        {/* Header (name + timestamp) */}
        {showAvatar && !isOwn && (
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className={cn(
                'text-sm font-medium',
                message.entityType === 'agent'
                  ? 'text-[var(--color-accent-purple,#a855f7)]'
                  : 'text-[var(--color-text-primary,#f0f0f5)]'
              )}
            >
              {displayName}
            </span>
            {shouldShowTimestamp && (
              <span className="text-xs text-[var(--color-text-muted,#606070)]">
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'rounded-lg p-3',
            isOwn
              ? 'bg-[var(--color-accent-cyan,#00d9ff)]/10 text-[var(--color-text-primary,#f0f0f5)]'
              : 'bg-[var(--color-bg-tertiary,#181824)] text-[var(--color-text-primary,#f0f0f5)]'
          )}
        >
          <MessageContent content={message.content} />
        </div>

        {/* Own message timestamp */}
        {isOwn && shouldShowTimestamp && (
          <span className="text-xs text-[var(--color-text-muted,#606070)] mt-1 block text-right">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;

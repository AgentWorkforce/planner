/**
 * MessageList Component
 *
 * Displays a list of messages with:
 * - Date grouping with separators
 * - Avatar grouping (hide for consecutive messages from same sender)
 * - Auto-scroll to new messages
 * - Loading and empty states
 */

import { useRef, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { DateSeparator } from './DateSeparator';
import { MessageBubble } from './MessageBubble';
import type { Message, MessageListProps } from '../../types/messaging';

/** Time gap (ms) before showing avatar again for same sender */
const AVATAR_TIME_GAP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Determine if avatar should be shown for this message.
 * Show avatar if:
 * 1. First message in the group
 * 2. Different sender from previous message
 * 3. More than 5 minutes since previous message
 */
function shouldShowAvatar(messages: Message[], index: number): boolean {
  if (index === 0) return true;

  const current = messages[index];
  const previous = messages[index - 1];

  // Safety check
  if (!current || !previous) return true;

  // Different sender
  if (current.from !== previous.from) return true;

  // Time gap
  const currentTime = new Date(current.timestamp).getTime();
  const previousTime = new Date(previous.timestamp).getTime();
  return currentTime - previousTime > AVATAR_TIME_GAP_MS;
}

/**
 * Group messages by date
 */
function groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = '';

  // Sort messages by timestamp first
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  sorted.forEach((message) => {
    const messageDate = new Date(message.timestamp).toDateString();
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groups.push({ date: message.timestamp, messages: [message] });
    } else {
      groups[groups.length - 1]?.messages.push(message);
    }
  });

  return groups;
}

/**
 * Empty state icon
 */
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/**
 * Loading indicator
 */
function LoadingDots() {
  return (
    <div className="flex gap-1">
      <span
        className="w-2 h-2 bg-[var(--color-text-muted,#606070)] rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 bg-[var(--color-text-muted,#606070)] rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-2 h-2 bg-[var(--color-text-muted,#606070)] rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

export function MessageList({
  messages,
  currentUserId,
  isLoading = false,
  emptyMessage = 'No messages yet',
  emptyDescription = 'Start the conversation by sending a message below',
  className,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Group messages by date
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Loading state
  if (isLoading && messages.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <LoadingDots />
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center text-center py-12',
          className
        )}
      >
        <MessageIcon className="w-12 h-12 text-[var(--color-text-muted,#606070)] mb-3" />
        <h3 className="text-lg font-medium text-[var(--color-text-primary,#f0f0f5)] mb-1">
          {emptyMessage}
        </h3>
        <p className="text-sm text-[var(--color-text-muted,#606070)]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 overflow-y-auto px-4 py-2', className)}>
      {groupedMessages.map(({ date, messages: dateMessages }) => (
        <div key={date}>
          <DateSeparator date={date} />

          <div className="space-y-1">
            {dateMessages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.from === currentUserId}
                showAvatar={shouldShowAvatar(dateMessages, index)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;

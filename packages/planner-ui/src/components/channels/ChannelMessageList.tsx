/**
 * ChannelMessageList Component
 *
 * Displays messages in a channel with:
 * - Avatars with user/agent color coding
 * - Message grouping (avatar only on sender change or >5min gap)
 * - Date dividers (Today, Yesterday, full date)
 * - Auto-scroll to new messages
 *
 * Adapted from relay-dashboard's ChannelMessageList.
 */

import { useRef, useEffect, useMemo } from 'react';
import type { RelayMessage } from '@/types';
import { QAMessageCard } from '../QAMessageCard';
import { isQAMessage } from '@/types/relay';

interface ChannelMessageListProps {
  messages: RelayMessage[];
  currentUserId?: string;
}

/**
 * List of chat messages with Slack-style layout
 */
export function ChannelMessageList({ messages, currentUserId }: ChannelMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: RelayMessage[] }[] = [];
    let currentDate = '';

    messages.forEach(message => {
      const messageDate = formatDateKey(message.timestamp);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
        <MessageIcon className="w-12 h-12 text-text-muted mb-3" />
        <h3 className="text-lg font-medium text-text-primary mb-1">
          No messages yet
        </h3>
        <p className="text-sm text-text-muted">
          Be the first to send a message in this channel
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {/* Message groups by date */}
      {groupedMessages.map(({ date, messages: dateMessages }) => (
        <div key={date}>
          {/* Date divider */}
          <DateDivider date={date} />

          {/* Messages for this date */}
          {dateMessages.map((message, index) => {
            // Check if this is a Q&A message
            if (message.data && isQAMessage(message.data)) {
              return (
                <div key={message.id} className="w-full flex justify-center">
                  <QAMessageCard {...message.data} timestamp={message.timestamp} />
                </div>
              );
            }

            // Regular chat message
            return (
              <MessageItem
                key={message.id}
                message={message}
                isOwn={message.from === currentUserId}
                showAvatar={shouldShowAvatar(dateMessages, index)}
              />
            );
          })}
        </div>
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface MessageItemProps {
  message: RelayMessage;
  isOwn: boolean;
  showAvatar: boolean;
}

/**
 * Individual message with Slack-style layout:
 * - Avatar on left (w-9)
 * - Content on right
 * - Name + timestamp header when avatar is shown
 */
function MessageItem({ message, isOwn, showAvatar }: MessageItemProps) {
  // Determine entity type from message or default based on name pattern
  const entityType = getEntityType(message);

  return (
    <div className={`group relative py-1 ${showAvatar ? 'mt-3' : ''}`}>
      <div className="flex gap-3">
        {/* Avatar column */}
        <div className="w-9 flex-shrink-0">
          {showAvatar && (
            <Avatar
              name={message.fromName || message.from}
              entityType={entityType}
            />
          )}
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Header (only show with avatar) */}
          {showAvatar && (
            <div className="flex items-center gap-2 mb-0.5">
              <button
                type="button"
                disabled
                className={`text-sm font-semibold ${
                  isOwn ? 'text-accent-cyan' : 'text-text-primary'
                } cursor-default`}
              >
                {message.fromName || message.from}
              </button>
              <span className="text-xs text-text-muted">
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}

          {/* Message content */}
          <div className="text-sm text-text-primary whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AvatarProps {
  name: string;
  entityType: 'user' | 'agent';
}

/**
 * Avatar with color-coded initial
 * - Purple for users
 * - Cyan for agents
 */
function Avatar({ name, entityType }: AvatarProps) {
  return (
    <div className={`
      w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium
      ${entityType === 'user'
        ? 'bg-purple-500/30 text-purple-300'
        : 'bg-accent-cyan/30 text-accent-cyan'}
    `}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface DateDividerProps {
  date: string;
}

/**
 * Date divider between message groups
 * Shows "Today", "Yesterday", or full date
 */
function DateDivider({ date }: DateDividerProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="text-xs font-medium text-text-muted px-2">
        {formatDateDisplay(date)}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Determine if avatar should be shown for this message.
 * Show avatar if:
 * 1. First message in the group
 * 2. Different sender from previous message
 * 3. More than 5 minutes since previous message
 */
function shouldShowAvatar(messages: RelayMessage[], index: number): boolean {
  if (index === 0) return true;

  const current = messages[index];
  const previous = messages[index - 1];

  // Show avatar if different sender
  if (current.from !== previous.from) return true;

  // Show avatar if more than 5 minutes since last message
  const currentTime = new Date(current.timestamp).getTime();
  const previousTime = new Date(previous.timestamp).getTime();
  return currentTime - previousTime > 5 * 60 * 1000;
}

/**
 * Determine entity type from message.
 * Uses fromEntityType if available, otherwise infers from name patterns.
 */
function getEntityType(message: RelayMessage): 'user' | 'agent' {
  // Check if message has explicit entity type
  if ('fromEntityType' in message && message.fromEntityType) {
    return message.fromEntityType as 'user' | 'agent';
  }

  // Infer from name patterns
  const name = message.from.toLowerCase();

  // Common user patterns
  if (name.startsWith('dev-user') || name.startsWith('user-') || name.includes('@')) {
    return 'user';
  }

  // Default to agent for most relay participants
  return 'agent';
}

/**
 * Create a date key from timestamp for grouping
 */
function formatDateKey(timestamp: string): string {
  return new Date(timestamp).toDateString();
}

/**
 * Format date for display in divider
 * Returns "Today", "Yesterday", or full date
 */
function formatDateDisplay(dateKey: string): string {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format timestamp for display in message header
 */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// Icons
// =============================================================================

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default ChannelMessageList;

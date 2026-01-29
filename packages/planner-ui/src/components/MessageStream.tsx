/**
 * MessageStream Component
 *
 * Displays a stream of messages in a channel.
 * Auto-scrolls to latest messages.
 */

import { useRef, useEffect } from 'react';
import type { RelayMessage } from '@/types';

interface MessageStreamProps {
  messages: RelayMessage[];
  currentUserId: string | null;
  isLoading?: boolean;
}

export function MessageStream({
  messages,
  currentUserId,
  isLoading = false,
}: MessageStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <p className="text-text-secondary">No messages yet</p>
        <p className="text-sm text-text-muted mt-1">
          Start the conversation by sending a message below
        </p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {Object.entries(groupedMessages).map(([dateLabel, dateMessages]) => (
        <div key={dateLabel}>
          <DateSeparator label={dateLabel} />
          <div className="space-y-3 mt-3">
            {dateMessages.map((message, index) => {
              const prevMessage = index > 0 ? dateMessages[index - 1] : null;
              const showAvatar = !prevMessage || prevMessage.from !== message.from;
              const isOwn = message.from === currentUserId;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

interface DateSeparatorProps {
  label: string;
}

function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="text-xs text-text-muted font-medium">{label}</span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

interface MessageBubbleProps {
  message: RelayMessage;
  isOwn: boolean;
  showAvatar: boolean;
}

function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  const isAgent = message.entityType === 'agent';

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {showAvatar && !isOwn && (
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
            isAgent ? 'bg-accent-purple/20 text-accent-purple' : 'bg-accent-cyan/20 text-accent-cyan'
          }`}
        >
          {isAgent ? 'AI' : message.fromName.slice(0, 2).toUpperCase()}
        </div>
      )}
      {!showAvatar && !isOwn && <div className="w-8" />}

      <div className={`flex-1 max-w-[80%] ${isOwn ? 'ml-8' : 'mr-8'}`}>
        {showAvatar && !isOwn && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-sm font-medium ${isAgent ? 'text-accent-purple' : 'text-text-primary'}`}>
              {message.fromName}
            </span>
            <span className="text-xs text-text-muted">
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        <div
          className={`rounded-lg p-3 ${
            isOwn
              ? 'bg-accent-cyan/10 text-text-primary'
              : 'bg-bg-tertiary text-text-primary'
          }`}
        >
          <MessageContent content={message.body} />
        </div>

        {isOwn && (
          <span className="text-xs text-text-muted mt-1 block text-right">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

interface MessageContentProps {
  content: string;
}

function MessageContent({ content }: MessageContentProps) {
  // Simple markdown-like processing
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
          return (
            <pre
              key={index}
              className="my-2 p-2 bg-bg-secondary rounded text-xs overflow-x-auto font-mono"
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

function processInlineFormatting(text: string): React.ReactNode {
  // Process inline code
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 bg-bg-secondary rounded text-xs font-mono text-accent-cyan"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupMessagesByDate(messages: RelayMessage[]): Record<string, RelayMessage[]> {
  const groups: Record<string, RelayMessage[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const message of messages) {
    const date = new Date(message.timestamp);
    let label: string;

    if (isSameDay(date, today)) {
      label = 'Today';
    } else if (isSameDay(date, yesterday)) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(message);
  }

  return groups;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

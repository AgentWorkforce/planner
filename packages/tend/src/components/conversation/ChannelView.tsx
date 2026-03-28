import type { ReactNode } from 'react';
import type { Message } from '@plannr/shared-ui';
import { useRelay } from '@/contexts/RelayContext';
import { useRelayChannel, type UseRelayChannelResult } from '@/hooks/useRelayChannel';
import { TerminalMessageList } from './TerminalMessageList';
import { TerminalInput } from './TerminalInput';

interface ChannelViewProps {
  channelId: string;
  placeholder?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  replyContext?: string | null;
  /** Sticky header rendered inside the scroll area (e.g. tab bar) */
  stickyHeader?: ReactNode;
  /** External channel hook — when provided, used instead of internal useRelayChannel */
  channel?: UseRelayChannelResult;
  /** Session ID — enables chat controls (model picker, plan mode, etc.) */
  sessionId?: string;
}

/**
 * Terminal-style channel view for relay channels.
 *
 * When `stickyHeader` is provided, scroll ownership moves to an outer
 * wrapper so the header sticks above scrolling messages and backdrop-blur
 * is visible as content passes beneath it.
 *
 * When `channel` is provided, it uses that hook result instead of creating
 * its own useRelayChannel. This allows the parent to provide enriched data
 * (e.g. session transcript history merged with relay messages).
 */
export function ChannelView({
  channelId,
  placeholder = 'Type your message...',
  emptyMessage = 'No messages yet',
  emptyDescription = 'Messages will appear here when the conversation starts',
  replyContext,
  stickyHeader,
  channel: externalChannel,
  sessionId,
}: ChannelViewProps) {
  const internalChannel = useRelayChannel({ channelId: externalChannel ? undefined : channelId });
  const { messages, isLoading, send, removeFromQueue } = externalChannel || internalChannel;
  const { userId } = useRelay();

  return (
    <div className="flex flex-col h-full">
      {/* Scroll area — owns overflow when stickyHeader is present */}
      <div className={stickyHeader ? 'flex-1 min-h-0 overflow-y-auto' : 'flex-1 min-h-0 flex flex-col'}>
        {stickyHeader && (
          <div className="sticky top-0 z-10">
            {stickyHeader}
          </div>
        )}
        <TerminalMessageList
          messages={messages as Message[]}
          currentUserId={userId}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          emptyDescription={emptyDescription}
          className={stickyHeader ? 'px-4 py-2' : 'flex-1 overflow-y-auto px-4 py-2'}
          onRemoveQueued={removeFromQueue}
        />
      </div>
      <div className="flex-shrink-0">
        <TerminalInput
          onSend={(content) => send(content)}
          placeholder={placeholder}
          initialValue={replyContext ?? undefined}
          sessionId={sessionId}
          sendDirective={sessionId ? (msg) => send(msg) : undefined}
        />
      </div>
    </div>
  );
}

/**
 * ChannelView Component
 *
 * Composite component combining ChannelHeader, ChannelMessageList, and MessageInput.
 * Provides a complete channel chat interface with message loading and sending.
 */

import { ChannelHeader } from './ChannelHeader';
import { ChannelMessageList } from './ChannelMessageList';
import { MessageInput } from './MessageInput';
import { useRelay } from '@/contexts/RelayContext';
import { useChannelMessages } from '@/hooks/useChannelMessages';

interface ChannelViewProps {
  channelId: string;
  channelName?: string;
}

/**
 * Complete channel chat view with header, message list, and input.
 *
 * @param channelId - Channel identifier (e.g., '#general', '#planner')
 * @param channelName - Optional display name (defaults to channelId without #)
 *
 * @example
 * ```tsx
 * <ChannelView channelId="#general" />
 * <ChannelView channelId="#plan-abc123" channelName="Plan ABC" />
 * ```
 */
export function ChannelView({ channelId, channelName }: ChannelViewProps) {
  const { connection, userId } = useRelay();
  const { messages, send, isLoading } = useChannelMessages(connection, channelId, true);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <ChannelHeader channelId={channelId} channelName={channelName} />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-muted">Loading messages...</div>
        </div>
      ) : (
        <ChannelMessageList messages={messages} currentUserId={userId || undefined} />
      )}

      <MessageInput
        onSend={send}
        placeholder={`Message ${channelName || channelId}...`}
        disabled={!connection.isConnected}
      />
    </div>
  );
}

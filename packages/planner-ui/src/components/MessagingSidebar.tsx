/**
 * MessagingSidebar Component
 *
 * Persistent sidebar for channel-based messaging.
 * Combines ChannelList, ChannelHeader, MessageStream, and MessageInput.
 *
 * When viewing a specific plan, only shows that plan's channel.
 * Use the envelope icon dropdown to switch to global channels or DM agents.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ChannelList } from './ChannelList';
import { ChannelHeader } from './ChannelHeader';
import { MessageStream } from './MessageStream';
import { MessageInput } from './MessageInput';
import { ChevronIcon } from './icons';
import { useChannels, useChannelMessages, usePresence } from '@/hooks';
import { useRelay } from '@/contexts';

interface PlanContext {
  planId: string;
  planTitle: string;
  stepId?: string;
  stepTitle?: string;
}

interface MessagingSidebarProps {
  /** Plan context for auto-joining channels and message metadata */
  planContext?: PlanContext;
  /** Whether sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

export function MessagingSidebar({
  planContext,
  isCollapsed = false,
  onCollapseChange,
}: MessagingSidebarProps) {
  // Relay connection from shared context
  const { connection } = useRelay();

  // Channel management
  const channels = useChannels(connection, planContext?.planId);

  // Active channel state
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  // Get active channel object
  const activeChannel = useMemo(() => {
    return channels.channels.find((c) => c.id === activeChannelId) || null;
  }, [channels.channels, activeChannelId]);

  // Messages for active channel
  const channelMessages = useChannelMessages(connection, activeChannelId);

  // Presence for active channel
  const presence = usePresence(connection, activeChannelId);

  // Get other channels for the switcher dropdown
  // When in plan context: show #planner (global) and the current plan's channel
  const otherChannels = useMemo(() => {
    if (!planContext) return [];
    return channels.channels.filter(
      (c) =>
        c.id !== activeChannelId &&
        (c.type === 'global' || c.planId === planContext.planId)
    );
  }, [channels.channels, activeChannelId, planContext]);

  // Handle channel selection
  const handleSelectChannel = useCallback(
    (channelId: string) => {
      setActiveChannelId(channelId);

      // Join channel if not already joined
      if (!channels.joinedChannels.has(channelId)) {
        channels.join(channelId);
      }
    },
    [channels]
  );

  // Handle DM to agent (future: create or navigate to DM channel)
  const handleDirectMessage = useCallback(
    (agentId: string, agentName: string) => {
      // For now, log and show a message - DM channels would be implemented later
      console.log(`DM to agent: ${agentName} (${agentId})`);
      // Future: Create or find DM channel and switch to it
    },
    []
  );

  // Handle close (collapse sidebar)
  const handleClose = useCallback(() => {
    onCollapseChange?.(true);
  }, [onCollapseChange]);

  // Handle expand
  const handleExpand = useCallback(() => {
    onCollapseChange?.(false);
  }, [onCollapseChange]);

  // Auto-select plan channel when in plan context
  useEffect(() => {
    if (!activeChannelId && channels.channels.length > 0 && planContext?.planId) {
      const planChannel = channels.channels.find(
        (c) => c.type === 'plan' && c.planId === planContext.planId
      );
      if (planChannel) {
        setActiveChannelId(planChannel.id);
      }
    }
  }, [activeChannelId, channels.channels, planContext?.planId]);

  // Determine if we should show the channel list panel
  // Hide it when viewing a specific plan (use envelope dropdown instead)
  const showChannelList = !planContext;

  // Calculate sidebar width based on state
  const sidebarWidth = isCollapsed ? 'w-12' : showChannelList ? 'w-96' : 'w-[340px]';

  // Collapsed view - still uses fixed positioning
  if (isCollapsed) {
    return (
      <>
        {/* Spacer to push main content left */}
        <div className="w-12 flex-shrink-0" />
        {/* Fixed collapsed sidebar */}
        <div className="fixed top-0 bottom-12 right-0 w-12 bg-bg-secondary border-l border-border-subtle flex flex-col items-center py-4 z-20">
          <button
            onClick={handleExpand}
            className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
            aria-label="Expand messaging sidebar"
          >
            <ChevronIcon direction="left" size="lg" />
          </button>

          <div className="mt-4">
            <div
              className={`w-3 h-3 rounded-full ${
                connection.isMock
                  ? 'bg-warning'
                  : connection.state === 'connected'
                  ? 'bg-success'
                  : 'bg-text-muted'
              }`}
              title={
                connection.isMock
                  ? 'Demo mode'
                  : connection.state === 'connected'
                  ? 'Connected'
                  : 'Disconnected'
              }
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Spacer to push main content left - matches sidebar width */}
      <div className={`${sidebarWidth} flex-shrink-0`} />
      {/* Fixed sidebar - positioned like left sidebar with top-0 bottom-12 */}
      <div className={`fixed top-0 bottom-12 right-0 ${sidebarWidth} bg-bg-secondary border-l border-border-subtle flex flex-col z-20`}>
      {/* Channel header - fixed at top */}
      <div className="flex-shrink-0">
        <ChannelHeader
          channel={activeChannel}
          presence={presence.members}
          isMock={connection.isMock}
          onClose={handleClose}
          otherChannels={otherChannels}
          onSwitchChannel={handleSelectChannel}
          onDirectMessage={handleDirectMessage}
        />
      </div>

      {/* Middle content area - takes remaining space */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Channel list (only shown when not in plan context) */}
        {showChannelList && (
          <div className="w-48 border-r border-border-subtle overflow-y-auto flex-shrink-0">
            <ChannelList
              channels={channels.channels}
              activeChannelId={activeChannelId}
              joinedChannels={channels.joinedChannels}
              onSelectChannel={handleSelectChannel}
              isLoading={channels.isLoading}
            />
          </div>
        )}

        {/* Message area - flex column with scrollable messages and fixed input */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {activeChannelId ? (
            <>
              {/* Messages - scrollable area */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <MessageStream
                  messages={channelMessages.messages}
                  currentUserId={connection.userId}
                  isLoading={channelMessages.isLoading}
                />
              </div>
              {/* Input - fixed at bottom */}
              <div className="flex-shrink-0">
                <MessageInput
                  onSend={channelMessages.send}
                  disabled={!connection.isConnected}
                  planContext={planContext}
                  placeholder={
                    connection.isConnected
                      ? 'Type a message...'
                      : connection.state === 'connecting'
                      ? 'Connecting...'
                      : 'Disconnected'
                  }
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-4">
              <div>
                <p className="text-text-secondary">
                  {planContext ? 'Loading channel...' : 'Select a channel'}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {planContext
                    ? 'Connecting to plan channel'
                    : 'Choose a channel from the list to start messaging'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection status bar - fixed at bottom */}
      <div className="flex-shrink-0">
        <ConnectionStatusBar
          state={connection.state}
          isMock={connection.isMock}
          error={connection.error}
          onReconnect={connection.reconnect}
        />
      </div>
      </div>
    </>
  );
}

interface ConnectionStatusBarProps {
  state: string;
  isMock: boolean;
  error: string | null;
  onReconnect: () => void;
}

function ConnectionStatusBar({
  state,
  isMock,
  error,
  onReconnect,
}: ConnectionStatusBarProps) {
  // Don't show status bar when connected and no issues
  if (state === 'connected' && !error && !isMock) {
    return null;
  }

  let message = '';
  let bgClass = '';
  let textClass = '';

  if (isMock) {
    message = 'Demo mode - AI responses are simulated';
    bgClass = 'bg-warning/10';
    textClass = 'text-warning';
  } else if (state === 'connecting') {
    message = 'Connecting to relay...';
    bgClass = 'bg-bg-tertiary';
    textClass = 'text-text-muted';
  } else if (state === 'reconnecting') {
    message = error || 'Reconnecting...';
    bgClass = 'bg-warning/10';
    textClass = 'text-warning';
  } else if (state === 'error' || state === 'disconnected') {
    message = error || 'Disconnected';
    bgClass = 'bg-error/10';
    textClass = 'text-error';
  }

  if (!message) return null;

  return (
    <div className={`px-3 py-2 text-xs ${bgClass} ${textClass} flex items-center justify-between`}>
      <span>{message}</span>
      {(state === 'error' || state === 'disconnected') && (
        <button
          onClick={onReconnect}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

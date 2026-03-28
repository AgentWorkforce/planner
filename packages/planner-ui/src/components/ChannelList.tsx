/**
 * ChannelList Component
 *
 * Displays available relay channels and allows selection/joining.
 */

import type { Channel } from '@/types';
import { ChannelIcon, UserIcon } from './icons';
import { useAgentOrchestration } from '@/hooks/useAgentOrchestration';

interface ChannelListProps {
  channels: Channel[];
  activeChannelId: string | null;
  joinedChannels: Set<string>;
  onSelectChannel: (channelId: string) => void;
  isLoading?: boolean;
}

export function ChannelList({
  channels,
  activeChannelId,
  joinedChannels,
  onSelectChannel,
  isLoading = false,
}: ChannelListProps) {
  // Get agent orchestration state for online/offline status
  const { agents } = useAgentOrchestration();

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 bg-bg-tertiary rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted text-sm">
        No channels available
      </div>
    );
  }

  // Group channels by type
  const channelChannels = channels.filter((c) => c.type !== 'dm');
  const dmChannels = channels.filter((c) => c.type === 'dm');

  return (
    <div className="flex flex-col">
      {channelChannels.length > 0 && (
        <ChannelGroup
          title="Channels"
          channels={channelChannels}
          activeChannelId={activeChannelId}
          joinedChannels={joinedChannels}
          onSelectChannel={onSelectChannel}
          agents={agents}
        />
      )}
      {dmChannels.length > 0 && (
        <ChannelGroup
          title="Direct Messages"
          channels={dmChannels}
          activeChannelId={activeChannelId}
          joinedChannels={joinedChannels}
          onSelectChannel={onSelectChannel}
          agents={agents}
        />
      )}
    </div>
  );
}

interface ChannelGroupProps {
  title: string;
  channels: Channel[];
  activeChannelId: string | null;
  joinedChannels: Set<string>;
  onSelectChannel: (channelId: string) => void;
  agents: Array<{ id: string; state: string }>;
}

function ChannelGroup({
  title,
  channels,
  activeChannelId,
  joinedChannels,
  onSelectChannel,
  agents,
}: ChannelGroupProps) {
  return (
    <div className="py-2">
      <div className="px-3 py-1 text-xs font-medium text-text-muted uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-0.5">
        {channels.map((channel) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isActive={channel.id === activeChannelId}
            isJoined={joinedChannels.has(channel.id)}
            onSelect={() => onSelectChannel(channel.id)}
            agents={agents}
          />
        ))}
      </div>
    </div>
  );
}

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  isJoined: boolean;
  onSelect: () => void;
  agents: Array<{ id: string; state: string }>;
}

function ChannelItem({ channel, isActive, isJoined, onSelect, agents }: ChannelItemProps) {
  // For DM channels, show agent name; for other channels, show channel name
  const displayName = channel.type === 'dm' && channel.agentName
    ? channel.agentName
    : channel.name;

  // Check if the agent (for DM channels) is online
  const isDmChannel = channel.type === 'dm';
  const isAgentOnline = isDmChannel && channel.agentId
    ? agents.some((agent) => agent.id === channel.agentId)
    : false;

  // Select appropriate icon based on channel type
  const Icon = isDmChannel ? UserIcon : ChannelIcon;

  return (
    <button
      className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-sm transition-colors ${
        isActive
          ? 'bg-accent-cyan/10 text-accent-cyan'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
      onClick={onSelect}
    >
      <div className="relative">
        <Icon size="sm" className={isActive ? 'text-accent-cyan' : 'text-text-muted'} />
        {isDmChannel && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-deep ${
              isAgentOnline ? 'bg-success' : 'bg-text-muted/30'
            }`}
            title={isAgentOnline ? 'Online' : 'Offline'}
          />
        )}
      </div>
      <span className="flex-1 truncate">{displayName}</span>
      {isJoined && !isActive && !isDmChannel && (
        <span className="w-2 h-2 rounded-full bg-success" title="Joined" />
      )}
    </button>
  );
}

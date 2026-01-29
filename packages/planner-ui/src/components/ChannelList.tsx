/**
 * ChannelList Component
 *
 * Displays available relay channels and allows selection/joining.
 */

import type { Channel } from '@/types';
import { ChannelIcon } from './icons';

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
  const globalChannels = channels.filter((c) => c.type === 'global');
  const planChannels = channels.filter((c) => c.type === 'plan');

  return (
    <div className="flex flex-col">
      {globalChannels.length > 0 && (
        <ChannelGroup
          title="Channels"
          channels={globalChannels}
          activeChannelId={activeChannelId}
          joinedChannels={joinedChannels}
          onSelectChannel={onSelectChannel}
        />
      )}
      {planChannels.length > 0 && (
        <ChannelGroup
          title="Plan Channels"
          channels={planChannels}
          activeChannelId={activeChannelId}
          joinedChannels={joinedChannels}
          onSelectChannel={onSelectChannel}
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
}

function ChannelGroup({
  title,
  channels,
  activeChannelId,
  joinedChannels,
  onSelectChannel,
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
}

function ChannelItem({ channel, isActive, isJoined, onSelect }: ChannelItemProps) {
  return (
    <button
      className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-sm transition-colors ${
        isActive
          ? 'bg-accent-cyan/10 text-accent-cyan'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
      onClick={onSelect}
    >
      <ChannelIcon size="sm" className={isActive ? 'text-accent-cyan' : 'text-text-muted'} />
      <span className="flex-1 truncate">{channel.name}</span>
      {isJoined && !isActive && (
        <span className="w-2 h-2 rounded-full bg-success" title="Joined" />
      )}
    </button>
  );
}

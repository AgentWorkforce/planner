/**
 * ChannelHeader Component
 *
 * Displays channel info, presence indicators, and channel switcher.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Channel, PresenceEntry } from '@/types';
import { ChannelIcon, UsersIcon, CloseIcon, EnvelopeIcon } from './icons';

interface ChannelHeaderProps {
  channel: Channel | null;
  presence: PresenceEntry[];
  isMock: boolean;
  onClose?: () => void;
  /** Other channels available to switch to */
  otherChannels?: Channel[];
  /** Callback when user selects a different channel */
  onSwitchChannel?: (channelId: string) => void;
  /** Callback when user wants to DM an agent */
  onDirectMessage?: (agentId: string, agentName: string) => void;
}

export function ChannelHeader({
  channel,
  presence,
  isMock,
  onClose,
  otherChannels = [],
  onSwitchChannel,
  onDirectMessage,
}: ChannelHeaderProps) {
  if (!channel) {
    return (
      <div className="h-14 border-b border-border-subtle px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-muted">
          <ChannelIcon size="lg" />
          <span className="font-medium">Select a channel</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
            aria-label="Close sidebar"
          >
            <CloseIcon size="lg" />
          </button>
        )}
      </div>
    );
  }

  const agentCount = presence.filter((p) => p.entityType === 'agent').length;
  const userCount = presence.filter((p) => p.entityType === 'user').length;
  const agents = presence.filter((p) => p.entityType === 'agent');

  // Check if we should show the channel switcher
  const hasOtherChannels = otherChannels.length > 0;
  const hasAgents = agents.length > 0;
  const showSwitcher = (hasOtherChannels || hasAgents) && (onSwitchChannel || onDirectMessage);

  return (
    <div className="h-14 border-b border-border-subtle px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ChannelIcon size="lg" className="text-accent-cyan" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{channel.name}</span>
            {isMock && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning rounded">
                DEMO
              </span>
            )}
          </div>
          {channel.description && (
            <p className="text-xs text-text-muted truncate max-w-[200px]">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PresenceIndicator
          agentCount={agentCount}
          userCount={userCount}
          members={presence}
        />
        {showSwitcher && (
          <ChannelSwitcher
            otherChannels={otherChannels}
            agents={agents}
            onSwitchChannel={onSwitchChannel}
            onDirectMessage={onDirectMessage}
          />
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
            aria-label="Close sidebar"
          >
            <CloseIcon size="lg" />
          </button>
        )}
      </div>
    </div>
  );
}

interface ChannelSwitcherProps {
  otherChannels: Channel[];
  agents: PresenceEntry[];
  onSwitchChannel?: (channelId: string) => void;
  onDirectMessage?: (agentId: string, agentName: string) => void;
}

function ChannelSwitcher({
  otherChannels,
  agents,
  onSwitchChannel,
  onDirectMessage,
}: ChannelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectChannel = useCallback(
    (channelId: string) => {
      onSwitchChannel?.(channelId);
      setIsOpen(false);
    },
    [onSwitchChannel]
  );

  const handleSelectAgent = useCallback(
    (agentId: string, agentName: string) => {
      onDirectMessage?.(agentId, agentName);
      setIsOpen(false);
    },
    [onDirectMessage]
  );

  const hasChannels = otherChannels.length > 0 && onSwitchChannel;
  const hasAgents = agents.length > 0 && onDirectMessage;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 transition-colors rounded-lg hover:bg-bg-hover ${
          isOpen ? 'text-accent-cyan bg-bg-hover' : 'text-text-muted hover:text-text-primary'
        }`}
        aria-label="Switch channel or message agent"
        aria-expanded={isOpen}
      >
        <EnvelopeIcon size="lg" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 py-2 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg z-50">
          {/* Channels section */}
          {hasChannels && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">
                Channels
              </div>
              {otherChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch.id)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left"
                >
                  <ChannelIcon size="sm" className="text-text-muted" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </>
          )}

          {/* Divider */}
          {hasChannels && hasAgents && (
            <div className="my-2 border-t border-border-subtle" />
          )}

          {/* Direct Message section */}
          {hasAgents && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">
                Direct Message
              </div>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent.id, agent.name)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left"
                >
                  <span className="w-2 h-2 rounded-full bg-accent-purple flex-shrink-0" />
                  <span className="truncate">{agent.name}</span>
                </button>
              ))}
            </>
          )}

          {/* Empty state */}
          {!hasChannels && !hasAgents && (
            <div className="px-3 py-2 text-sm text-text-muted">
              No channels or agents available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PresenceIndicatorProps {
  agentCount: number;
  userCount: number;
  members: PresenceEntry[];
}

function PresenceIndicator({ agentCount, userCount, members }: PresenceIndicatorProps) {
  const total = members.length;

  if (total === 0) {
    return null;
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-secondary transition-colors rounded hover:bg-bg-hover">
        <UsersIcon size="sm" />
        <span>{total}</span>
      </button>

      {/* Tooltip with member list */}
      <div className="absolute right-0 top-full mt-1 w-48 py-2 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="px-3 py-1 text-xs text-text-muted border-b border-border-subtle mb-1">
          {agentCount > 0 && <span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>}
          {agentCount > 0 && userCount > 0 && <span> · </span>}
          {userCount > 0 && <span>{userCount} user{userCount !== 1 ? 's' : ''}</span>}
        </div>
        <div className="max-h-32 overflow-y-auto">
          {members.map((member) => (
            <div
              key={member.id}
              className="px-3 py-1 flex items-center gap-2 text-sm"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  member.entityType === 'agent' ? 'bg-accent-purple' : 'bg-accent-cyan'
                }`}
              />
              <span className="text-text-secondary truncate">{member.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

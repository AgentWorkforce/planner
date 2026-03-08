/**
 * AgentTabBar
 *
 * Horizontal tab bar above conversation for switching between:
 * - Main tab (project conversation)
 * - Individual agent tabs (one per active agent)
 *
 * Active tab highlighted with accent-primary border-bottom.
 * Tabs overflow with horizontal scroll and fade edges.
 */

import { useRef, useEffect, useState } from 'react';
import { AgentTab } from './AgentTab';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'completed' | 'blocked';
  unreadCount?: number;
}

interface AgentTabBarProps {
  /** Currently active channel ID */
  activeChannelId: string;

  /** Callback when tab is selected */
  onSelectChannel: (channelId: string) => void;

  /** Active agents to display tabs for */
  agents: Agent[];

  /** Whether user has viewed main tab since last message */
  mainUnreadCount?: number;

  /** Plan channel ID (truthy when plan exists) */
  planChannelId?: string;

  /** Unread message count for plan channel */
  planUnreadCount?: number;

  /** Forge run ID (truthy when build exists — active or completed) */
  forgeRunId?: string | null;

  /** Unread event count for forge tab */
  forgeUnreadCount?: number;
}

export function AgentTabBar({
  activeChannelId,
  onSelectChannel,
  agents,
  mainUnreadCount = 0,
  planChannelId,
  planUnreadCount = 0,
  forgeRunId,
  forgeUnreadCount = 0,
}: AgentTabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Update fade indicators when scroll position changes
  const updateFadeIndicators = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftFade(scrollLeft > 0);
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1);
  };

  // Update fade indicators on mount and when agents change
  useEffect(() => {
    updateFadeIndicators();
  }, [agents]);

  return (
    <div className="relative backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg-chrome), transparent 50%)' }}>
      {/* Left fade */}
      {showLeftFade && (
        <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--color-bg-chrome), transparent 50%), transparent)' }} />
      )}

      {/* Scrollable tab container */}
      <div
        ref={scrollContainerRef}
        onScroll={updateFadeIndicators}
        className="flex overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Main tab - always present */}
        <button
          onClick={() => onSelectChannel('main')}
          className={`
            relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
            ${activeChannelId === 'main'
              ? 'text-accent-primary border-b-2 !border-accent-primary'
              : 'text-text-secondary hover:text-text-primary border-b-2 !border-transparent'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <span>Main</span>
            {mainUnreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent-primary/20 text-accent-primary">
                {mainUnreadCount}
              </span>
            )}
          </div>
        </button>

        {/* Planning tab - shows when plan exists */}
        {planChannelId && (
          <button
            onClick={() => onSelectChannel('planning')}
            className={`
              relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
              ${activeChannelId === 'planning'
                ? 'text-accent-primary border-b-2 !border-accent-primary'
                : 'text-text-secondary hover:text-text-primary border-b-2 !border-transparent'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span>Planning</span>
              {planUnreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent-primary/20 text-accent-primary">
                  {planUnreadCount}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Forge tab - shows when build exists */}
        {forgeRunId && (
          <button
            onClick={() => onSelectChannel('forge')}
            className={`
              relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
              ${activeChannelId === 'forge'
                ? 'text-accent-secondary border-b-2 !border-accent-secondary'
                : 'text-text-secondary hover:text-text-primary border-b-2 !border-transparent'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">▸</span>
              <span>Forge</span>
              {forgeUnreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent-secondary/20 text-accent-secondary">
                  {forgeUnreadCount}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Agent tabs */}
        {agents.map((agent) => (
          <AgentTab
            key={agent.id}
            agent={agent}
            isActive={activeChannelId === `agent-${agent.id}`}
            onClick={() => onSelectChannel(`agent-${agent.id}`)}
          />
        ))}
      </div>

      {/* Right fade */}
      {showRightFade && (
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10" style={{ background: 'linear-gradient(to left, color-mix(in srgb, var(--color-bg-chrome), transparent 50%), transparent)' }} />
      )}
    </div>
  );
}

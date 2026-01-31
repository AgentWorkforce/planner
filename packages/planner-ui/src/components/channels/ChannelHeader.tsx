/**
 * ChannelHeader Component
 *
 * Displays channel name with optional back navigation button.
 * Used in channel detail views to provide context and navigation.
 */

import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, ChannelIcon } from '@/components/icons';

interface ChannelHeaderProps {
  channelId: string;
  channelName?: string;
  showBack?: boolean;
}

/**
 * Channel header with name and optional back navigation.
 *
 * @param channelId - The channel identifier (e.g., '#planner')
 * @param channelName - Optional display name (defaults to channelId without #)
 * @param showBack - Whether to show back button (default: true)
 *
 * @example
 * ```tsx
 * <ChannelHeader channelId="#planner" />
 * <ChannelHeader channelId="#plan-abc" channelName="Plan ABC" showBack={false} />
 * ```
 */
export function ChannelHeader({ channelId, channelName, showBack = true }: ChannelHeaderProps) {
  const navigate = useNavigate();

  // Extract display name from channel ID if not provided
  // #planner -> planner, #plan-abc123 -> plan-abc123
  const displayName = channelName || channelId.replace(/^#/, '');

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-bg-secondary border-b border-border-subtle">
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="Go back"
        >
          <ChevronLeftIcon size="md" />
        </button>
      )}
      <ChannelIcon size="md" className="text-text-muted" />
      <h1 className="text-lg font-semibold text-text-primary">{displayName}</h1>
    </div>
  );
}

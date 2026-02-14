export type SystemEventType = 'step_completed' | 'agent_decision' | 'context_shift' | 'phase_transition' | 'general';

export interface SystemEventMetadata {
  label: string;
  value: string;
  onClick?: () => void;
}

export interface SystemEventProps {
  type: SystemEventType;
  content: string;
  metadata?: SystemEventMetadata[];
  timestamp: string;
}

/**
 * SystemEvent
 *
 * Compact inline system event marker. Attention level 1 - blends into background.
 *
 * Renders format: `┊ Step completed · 4m 12s · PR #43 created`
 * - Uses ┊ as left border indicator
 * - Middle dot (·) separates metadata items
 * - Minimal vertical padding (py-1)
 * - Blends into background with text-text-muted
 * - Clickable metadata items get hover:text-accent-primary cursor-pointer
 */
export function SystemEvent({ content, metadata, timestamp }: SystemEventProps) {
  const formattedTime = formatRelativeTime(timestamp);

  return (
    <div className="flex items-center gap-2 py-1 text-xs text-text-muted">
      {/* Vertical bar indicator */}
      <span className="text-border-subtle" aria-hidden="true">
        ┊
      </span>

      {/* Content */}
      <span>{content}</span>

      {/* Separator */}
      <span aria-hidden="true">·</span>

      {/* Time */}
      <span>{formattedTime}</span>

      {/* Optional metadata items */}
      {metadata && metadata.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          <span aria-hidden="true">·</span>
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="hover:text-accent-primary cursor-pointer transition-colors"
            >
              {item.label}: {item.value}
            </button>
          ) : (
            <span>
              {item.label}: {item.value}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Format timestamp as relative time (e.g., "4m 12s", "2h 30m", "3d")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s`;
  } else if (diffSec < 3600) {
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    const min = Math.floor((diffSec % 3600) / 60);
    return min > 0 ? `${hours}h ${min}m` : `${hours}h`;
  } else {
    const days = Math.floor(diffSec / 86400);
    return `${days}d`;
  }
}

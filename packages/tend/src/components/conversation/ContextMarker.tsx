import { Focus, Layers, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextMarkerProps {
  type: 'focus_shift' | 'phase_change' | 'agent_switch';
  label: string;
  timestamp: string;
  onClick?: () => void;
}

function getIcon(type: ContextMarkerProps['type']) {
  switch (type) {
    case 'focus_shift':
      return <Focus className="w-4 h-4" />;
    case 'phase_change':
      return <Layers className="w-4 h-4" />;
    case 'agent_switch':
      return <Users className="w-4 h-4" />;
    default:
      return null;
  }
}

function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffMs = now.getTime() - eventTime.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) {
    const minutes = diffMinutes;
    const seconds = diffSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }
  if (diffHours < 24) {
    const minutes = diffMinutes % 60;
    return `${diffHours}h ${minutes}m`;
  }
  return eventTime.toLocaleDateString();
}

function getColor(type: ContextMarkerProps['type']) {
  switch (type) {
    case 'focus_shift':
      return 'text-accent-cyan';
    case 'phase_change':
      return 'text-accent-orange';
    case 'agent_switch':
      return 'text-accent-purple';
    default:
      return 'text-text-muted';
  }
}

export function ContextMarker({ type, label, timestamp, onClick }: ContextMarkerProps) {
  const formattedTime = formatTimestamp(timestamp);
  const colorClass = getColor(type);

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 px-4 my-2 group",
        onClick && "cursor-pointer hover:bg-bg-hover transition-colors rounded-lg"
      )}
      onClick={onClick}
    >
      <div className="flex-1 h-px bg-border-subtle" />
      <div className={cn("flex items-center gap-2 font-medium text-sm", colorClass)}>
        {getIcon(type)}
        <span>{label}</span>
        <span className="text-text-muted font-normal text-xs">
          {formattedTime}
        </span>
      </div>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

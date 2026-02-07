import { CheckCircle2, UserPlus, UserMinus, GitBranch, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemEventProps {
  type: 'focus_change' | 'agent_joined' | 'agent_left' | 'graduation' | 'status_change';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  onClick?: () => void;
}

function getIcon(type: SystemEventProps['type']) {
  switch (type) {
    case 'focus_change':
      return <AlertCircle className="w-3 h-3" />;
    case 'agent_joined':
      return <UserPlus className="w-3 h-3" />;
    case 'agent_left':
      return <UserMinus className="w-3 h-3" />;
    case 'graduation':
      return <GitBranch className="w-3 h-3" />;
    case 'status_change':
      return <CheckCircle2 className="w-3 h-3" />;
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

export function SystemEvent({ type, message, timestamp, metadata, onClick }: SystemEventProps) {
  const formattedTime = formatTimestamp(timestamp);

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2 px-4 group",
        onClick && "cursor-pointer hover:bg-bg-subtle transition-colors"
      )}
      onClick={onClick}
    >
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap font-normal">
        <span className="text-text-muted/60">┊</span>
        {getIcon(type)}
        <span>{message}</span>
        <span className="text-text-muted/60">·</span>
        <span className="text-text-muted/80">{formattedTime}</span>
        {metadata?.pr && (
          <>
            <span className="text-text-muted/60">·</span>
            <span className="text-accent-cyan/80">PR #{metadata.pr}</span>
          </>
        )}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

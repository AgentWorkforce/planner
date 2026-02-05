import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Session } from '@/hooks/useIdeationApi';
import { SessionStatusBadge } from './SessionStatusBadge';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
}

function truncateIntent(intent: string, maxLength = 50): string {
  if (intent.length <= maxLength) return intent;
  return intent.slice(0, maxLength).trim() + '...';
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function SessionItem({ session, isActive }: SessionItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/ideation/session/${session.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-3 py-2 transition-colors',
        'hover:bg-bg-tertiary focus-visible:bg-bg-tertiary',
        isActive && 'border-l-2 border-accent-cyan bg-bg-tertiary/50'
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-primary font-medium truncate">
          {truncateIntent(session.source?.initial_intent ?? 'Untitled')}
        </span>
        <div className="flex items-center justify-between gap-2">
          <SessionStatusBadge
            status={session.status}
            sendCount={session.planner_sends?.length ?? 0}
          />
          <span className="text-xs text-text-muted">
            {formatRelativeTime(session.updated_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

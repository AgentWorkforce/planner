import { useParams } from 'react-router-dom';
import { useSessions } from '@/hooks/useSessions';
import { SessionItem } from './SessionItem';
import { Skeleton } from '@/components/ui';
import { Button } from '@/components/ui';
import { BrainIcon } from '@/components/icons';

export function SessionList() {
  const { sessions, loading, error, refetch } = useSessions();
  const { id: activeSessionId } = useParams<{ id: string }>();

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-error text-sm mb-2">Failed to load sessions</p>
        <Button variant="ghost" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-accent-purple/10 flex items-center justify-center mb-4">
          <BrainIcon size="lg" className="text-accent-purple" />
        </div>
        <p className="text-sm text-text-secondary mb-1">No sessions yet</p>
        <p className="text-xs text-text-muted">
          Start your first brainstorm!
        </p>
      </div>
    );
  }

  // Sessions list
  return (
    <div className="flex flex-col">
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
        />
      ))}
    </div>
  );
}

import type { ChangeRequest } from '@/types';
import { AlertIcon } from './icons';

interface ChangeRequestNotificationProps {
  changeRequests: ChangeRequest[];
  onRequestClick?: (changeRequestId: string) => void;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Notification banner showing pending change requests from orchestrator.
 * Displayed prominently at the top of the plan view.
 */
export function ChangeRequestNotification({
  changeRequests,
  onRequestClick,
}: ChangeRequestNotificationProps) {
  const pendingRequests = changeRequests.filter((cr) => cr.status === 'pending');

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-warning/10 border border-warning/30 rounded-xl p-4"
      role="alert"
    >
      <div className="flex items-center gap-3 mb-3">
        <AlertIcon size="lg" className="text-warning" />
        <span className="font-medium text-warning">
          {pendingRequests.length === 1
            ? '1 change request requires attention'
            : `${pendingRequests.length} change requests require attention`}
        </span>
      </div>
      <ul className="space-y-2">
        {pendingRequests.map((request) => (
          <li key={request.change_request_id}>
            <button
              className="w-full flex flex-col gap-1 p-3 bg-bg-secondary rounded-lg text-left hover:bg-bg-hover transition-colors"
              onClick={() => onRequestClick?.(request.change_request_id)}
              aria-label={`Review change request from run ${request.run_id}`}
            >
              <span className="text-sm text-text-primary">{truncateText(request.reason, 80)}</span>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>Run: {request.run_id}</span>
                <span>{new Date(request.created_at).toLocaleString()}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

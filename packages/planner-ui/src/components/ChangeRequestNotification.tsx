import type { ChangeRequest } from '@/types';

interface ChangeRequestNotificationProps {
  /** List of pending change requests */
  changeRequests: ChangeRequest[];
  /** Callback when user clicks on a change request */
  onRequestClick?: (changeRequestId: string) => void;
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
    <div className="change-request-notification" role="alert">
      <div className="change-request-header">
        <span className="change-request-icon" aria-hidden="true">
          ⚠️
        </span>
        <span className="change-request-title">
          {pendingRequests.length === 1
            ? '1 change request requires attention'
            : `${pendingRequests.length} change requests require attention`}
        </span>
      </div>
      <ul className="change-request-list">
        {pendingRequests.map((request) => (
          <li key={request.change_request_id} className="change-request-item">
            <button
              className="change-request-button"
              onClick={() => onRequestClick?.(request.change_request_id)}
              aria-label={`Review change request from run ${request.run_id}`}
            >
              <span className="change-request-reason">{truncateText(request.reason, 80)}</span>
              <span className="change-request-source">Run: {request.run_id}</span>
              <span className="change-request-time">
                {new Date(request.created_at).toLocaleString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

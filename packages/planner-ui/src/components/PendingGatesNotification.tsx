import type { PendingGate } from '@/types';

interface PendingGatesNotificationProps {
  /** List of pending gates */
  gates: PendingGate[];
  /** Callback when user clicks on a gate */
  onGateClick?: (stepId: string) => void;
}

/**
 * Notification banner showing pending gates that need human approval.
 * Displayed prominently at the top of the plan view.
 */
export function PendingGatesNotification({ gates, onGateClick }: PendingGatesNotificationProps) {
  if (gates.length === 0) {
    return null;
  }

  return (
    <div className="pending-gates-notification" role="alert">
      <div className="pending-gates-header">
        <span className="pending-gates-icon" aria-hidden="true">
          ⏳
        </span>
        <span className="pending-gates-title">
          {gates.length === 1
            ? '1 gate awaiting approval'
            : `${gates.length} gates awaiting approval`}
        </span>
      </div>
      <ul className="pending-gates-list">
        {gates.map((gate) => (
          <li key={gate.step_id} className="pending-gate-item">
            <button
              className="pending-gate-button"
              onClick={() => onGateClick?.(gate.step_id)}
              aria-label={`Review gate for ${gate.step_title}`}
            >
              <span className="pending-gate-step">{gate.step_title}</span>
              {gate.gate.approver_role && (
                <span className="pending-gate-approver">Approver: {gate.gate.approver_role}</span>
              )}
              <span className="pending-gate-time">
                Blocked since {new Date(gate.blocked_since).toLocaleTimeString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

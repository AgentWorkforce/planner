import { useState } from 'react';
import type { PendingGate, GateApprovalInfo } from '@/types';

interface GateApprovalCardProps {
  /** Pending gate data */
  gate: PendingGate;
  /** Approval history for this gate */
  history?: GateApprovalInfo[];
  /** Whether approval is in progress */
  isLoading?: boolean;
  /** Callback when user approves */
  onApprove: (stepId: string) => void;
  /** Callback when user rejects */
  onReject: (stepId: string, reason?: string) => void;
  /** Callback to view step */
  onViewStep?: (stepId: string) => void;
}

/**
 * Card for a pending gate with approve/reject actions.
 */
export function GateApprovalCard({
  gate,
  history,
  isLoading = false,
  onApprove,
  onReject,
  onViewStep,
}: GateApprovalCardProps) {
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = () => {
    onApprove(gate.step_id);
  };

  const handleReject = () => {
    if (showRejectReason) {
      onReject(gate.step_id, rejectReason || undefined);
      setShowRejectReason(false);
      setRejectReason('');
    } else {
      setShowRejectReason(true);
    }
  };

  const handleCancelReject = () => {
    setShowRejectReason(false);
    setRejectReason('');
  };

  return (
    <div className="gate-approval-card">
      <div className="gate-approval-header">
        <span className="gate-approval-icon" aria-hidden="true">
          🔒
        </span>
        <div className="gate-approval-title">
          <h4>{gate.step_title}</h4>
          <span className="gate-approval-type">Human Approval Required</span>
        </div>
      </div>

      {gate.step_description && (
        <p className="gate-approval-description">{gate.step_description}</p>
      )}

      <div className="gate-approval-meta">
        {gate.gate.approver_role && (
          <div className="gate-approval-role">
            <span className="label">Approver role:</span>
            <span className="value">{gate.gate.approver_role}</span>
          </div>
        )}
        <div className="gate-approval-blocked">
          <span className="label">Blocked since:</span>
          <span className="value">{new Date(gate.blocked_since).toLocaleString()}</span>
        </div>
      </div>

      {showRejectReason ? (
        <div className="gate-approval-reject-form">
          <label htmlFor={`reject-reason-${gate.step_id}`}>Reason for rejection (optional):</label>
          <textarea
            id={`reject-reason-${gate.step_id}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Provide a reason..."
            rows={2}
          />
          <div className="gate-approval-reject-actions">
            <button className="btn btn-sm btn-secondary" onClick={handleCancelReject}>
              Cancel
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={handleReject}
              disabled={isLoading}
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      ) : (
        <div className="gate-approval-actions">
          {onViewStep && (
            <button
              className="btn btn-sm btn-link"
              onClick={() => onViewStep(gate.step_id)}
            >
              View Step
            </button>
          )}
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleReject}
            disabled={isLoading}
          >
            Reject
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleApprove}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      )}

      {history && history.length > 0 && (
        <GateApprovalHistory history={history} />
      )}
    </div>
  );
}

interface GateApprovalHistoryProps {
  history: GateApprovalInfo[];
}

/**
 * Display approval history for a gate.
 */
export function GateApprovalHistory({ history }: GateApprovalHistoryProps) {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="gate-approval-history">
      <h5>Approval History</h5>
      <ul>
        {history.map((entry, index) => (
          <li key={index} className={`history-entry history-entry--${entry.status}`}>
            <span className="history-status">
              {entry.status === 'approved' ? '✓' : entry.status === 'rejected' ? '✗' : '⏳'}
            </span>
            <span className="history-details">
              {entry.status === 'approved' && entry.approved_by
                ? `Approved by ${entry.approved_by}`
                : entry.status === 'rejected'
                ? `Rejected${entry.rejection_reason ? `: ${entry.rejection_reason}` : ''}`
                : 'Pending'}
            </span>
            {entry.approved_at && (
              <span className="history-time">{new Date(entry.approved_at).toLocaleString()}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

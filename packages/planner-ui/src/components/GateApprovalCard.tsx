import { useState } from 'react';
import { LockIcon, CheckIcon, CloseIcon } from './icons';
import type { PendingGate, GateApprovalInfo } from '@/types';

interface GateApprovalCardProps {
  gate: PendingGate;
  history?: GateApprovalInfo[];
  isLoading?: boolean;
  onApprove: (stepId: string) => void;
  onReject: (stepId: string, reason?: string) => void;
  onViewStep?: (stepId: string) => void;
}

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
    <div className="bg-gradient-to-br from-bg-bg-card to-bg-bg-elevated border border-warning/30 rounded-xl p-4 shadow-glow-orange/20">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <LockIcon size="lg" className="text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-lg text-text-primary truncate">{gate.step_title}</h4>
          <span className="text-xs text-warning uppercase tracking-wide font-semibold">
            Human Approval Required
          </span>
        </div>
      </div>

      {gate.step_description && (
        <p className="text-sm text-text-secondary mb-4">{gate.step_description}</p>
      )}

      <div className="space-y-1 text-xs mb-4">
        {gate.gate.approver_role && (
          <div className="flex gap-2">
            <span className="text-text-muted">Approver role:</span>
            <span className="text-text-secondary">{gate.gate.approver_role}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-text-muted">Blocked since:</span>
          <span className="text-text-secondary">{new Date(gate.blocked_since).toLocaleString()}</span>
        </div>
      </div>

      {showRejectReason ? (
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`reject-reason-${gate.step_id}`}
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              Reason for rejection (optional):
            </label>
            <textarea
              id={`reject-reason-${gate.step_id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a reason..."
              rows={2}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-all duration-150 hover:border-border-light"
              onClick={handleCancelReject}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-error text-white font-medium rounded-lg transition-all duration-150 hover:shadow-[0_0_20px_rgba(255,71,87,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleReject}
              disabled={isLoading}
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          {onViewStep && (
            <button
              className="px-3 py-1.5 text-sm text-accent-cyan hover:underline"
              onClick={() => onViewStep(gate.step_id)}
            >
              View Step
            </button>
          )}
          <button
            className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-all duration-150 hover:border-border-light disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleReject}
            disabled={isLoading}
          >
            Reject
          </button>
          <button
            className="px-3 py-1.5 text-sm bg-success text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-green disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleApprove}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      )}

      {history && history.length > 0 && <GateApprovalHistory history={history} />}
    </div>
  );
}

interface GateApprovalHistoryProps {
  history: GateApprovalInfo[];
}

export function GateApprovalHistory({ history }: GateApprovalHistoryProps) {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle">
      <h5 className="text-sm font-medium text-text-secondary mb-2">Approval History</h5>
      <ul className="space-y-2">
        {history.map((entry, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 text-xs ${
              entry.status === 'approved'
                ? 'text-success'
                : entry.status === 'rejected'
                ? 'text-error'
                : 'text-text-muted'
            }`}
          >
            <span className="flex-shrink-0">
              {entry.status === 'approved' ? (
                <CheckIcon size="sm" />
              ) : entry.status === 'rejected' ? (
                <CloseIcon size="sm" />
              ) : (
                <span className="w-3 h-3 rounded-full border-2 border-current" />
              )}
            </span>
            <span className="flex-1">
              {entry.status === 'approved' && entry.approved_by
                ? `Approved by ${entry.approved_by}`
                : entry.status === 'rejected'
                ? `Rejected${entry.rejection_reason ? `: ${entry.rejection_reason}` : ''}`
                : 'Pending'}
            </span>
            {entry.approved_at && (
              <span className="text-text-muted">{new Date(entry.approved_at).toLocaleString()}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

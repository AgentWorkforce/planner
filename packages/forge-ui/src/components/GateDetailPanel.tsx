/**
 * GateDetailPanel - Modal panel for reviewing and approving/rejecting a gate
 *
 * Shows task details, acceptance criteria, artifacts, and provides
 * approve/reject actions with confirmation dialogs.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { GateArtifactsList } from './GateArtifactsList';
import { approveGate, rejectGate } from '@/api';
import type { Gate, AcceptanceCriterion } from '@/types';

interface GateDetailPanelProps {
  gate: Gate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
  onRejected?: () => void;
}

export function GateDetailPanel({
  gate,
  open,
  onOpenChange,
  onApproved,
  onRejected,
}: GateDetailPanelProps) {
  const [comment, setComment] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!gate) return;

    setIsApproving(true);
    setError(null);

    try {
      await approveGate(gate.task_id, comment || undefined);
      setComment('');
      onOpenChange(false);
      onApproved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve gate');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!gate || !rejectReason.trim()) return;

    setIsRejecting(true);
    setError(null);

    try {
      await rejectGate(gate.task_id, rejectReason.trim());
      setRejectReason('');
      setShowRejectDialog(false);
      onOpenChange(false);
      onRejected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject gate');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleClose = () => {
    setComment('');
    setError(null);
    onOpenChange(false);
  };

  const handleRejectDialogClose = () => {
    setRejectReason('');
    setShowRejectDialog(false);
  };

  if (!gate) return null;

  const acceptanceCriteria = gate.context?.acceptance_criteria || [];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GateIcon className="h-5 w-5 text-amber-500" />
              Gate Review
            </DialogTitle>
            <DialogDescription>
              Review the task details and artifacts before approving or rejecting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Task Details Section */}
            <section>
              <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Task Details
              </h3>
              <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="font-medium text-text-primary">{gate.title}</h4>
                  {gate.description && (
                    <p className="mt-1 text-sm text-text-muted">{gate.description}</p>
                  )}
                </div>
                {gate.approver_role && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-muted">Approver Role:</span>
                    <span className="text-amber-500 font-medium">{gate.approver_role}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Acceptance Criteria Section */}
            {acceptanceCriteria.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                  Acceptance Criteria
                </h3>
                <ul className="space-y-2">
                  {acceptanceCriteria.map((criterion) => (
                    <AcceptanceCriterionItem key={criterion.id} criterion={criterion} />
                  ))}
                </ul>
              </section>
            )}

            {/* Artifacts Section */}
            <section>
              <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Artifacts
              </h3>
              <div className="bg-bg-tertiary rounded-lg p-4">
                <GateArtifactsList artifacts={gate.artifacts || []} />
              </div>
            </section>

            {/* Notes Section */}
            <section>
              <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Approval Notes (Optional)
              </h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add any notes or comments about this approval..."
                className="w-full h-24 px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              />
            </section>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
              disabled={isApproving}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </Button>
            <Button
              variant="success"
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isApproving ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={handleRejectDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <WarningIcon className="h-5 w-5" />
              Confirm Rejection
            </DialogTitle>
            <DialogDescription>
              Rejecting will fail this task and pause the run. This action requires a reason.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-sm">
              <strong>Warning:</strong> Rejecting will fail this task and pause the run.
              The team will need to address the issues before the run can continue.
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please explain why this gate is being rejected..."
                className="w-full h-24 px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleRejectDialogClose}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isRejecting || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Rejecting...
                </>
              ) : (
                'Confirm Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AcceptanceCriterionItemProps {
  criterion: AcceptanceCriterion;
}

function AcceptanceCriterionItem({ criterion }: AcceptanceCriterionItemProps) {
  return (
    <li className="flex items-start gap-3 p-3 bg-bg-tertiary rounded-lg">
      <div className="flex-shrink-0 mt-0.5">
        {criterion.verified ? (
          <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
            <CheckIcon className="h-3 w-3 text-success" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-border-subtle" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">{criterion.description}</p>
        {criterion.type && (
          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-bg-card rounded text-text-muted">
            {criterion.type}
          </span>
        )}
      </div>
    </li>
  );
}

function GateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
    </svg>
  );
}

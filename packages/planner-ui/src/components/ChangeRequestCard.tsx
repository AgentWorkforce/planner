import { useState } from 'react';
import type { ChangeRequest, Step, RevisionStatus } from '@/types';
import { AlertIcon } from './icons';

interface ChangeRequestCardProps {
  changeRequest: ChangeRequest;
  currentSteps: Step[];
  isLoading?: boolean;
  onViewDiff: (changeRequest: ChangeRequest) => void;
  onAccept: (changeRequestId: string) => void;
  onReject: (changeRequestId: string, reason?: string) => void;
  onAcceptRevision?: (changeRequestId: string) => void;
  onRejectRevision?: (changeRequestId: string) => void;
  onEditDraft?: (changeRequestId: string, draftVersion: number) => void;
}

/**
 * Card showing change request details with accept/reject actions.
 */
export function ChangeRequestCard({
  changeRequest,
  currentSteps,
  isLoading = false,
  onViewDiff,
  onAccept,
  onReject,
  onAcceptRevision,
  onRejectRevision,
  onEditDraft,
}: ChangeRequestCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const revisionStatus = changeRequest.revision_status || 'none';

  const { suggested_changes } = changeRequest;

  const handleAccept = () => {
    onAccept(changeRequest.change_request_id);
  };

  const handleReject = () => {
    if (showRejectForm) {
      onReject(changeRequest.change_request_id, rejectReason || undefined);
      setShowRejectForm(false);
      setRejectReason('');
    } else {
      setShowRejectForm(true);
    }
  };

  const handleCancelReject = () => {
    setShowRejectForm(false);
    setRejectReason('');
  };

  // Summarize the changes
  const addCount = suggested_changes.add_steps?.length || 0;
  const modifyCount = suggested_changes.modify_steps?.length || 0;
  const removeCount = suggested_changes.remove_steps?.length || 0;

  return (
    <div className="bg-bg-card border border-warning/30 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-4 border-b border-border-subtle">
        <AlertIcon size="lg" className="text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display font-medium text-text-primary">Change Request</h4>
            <RevisionStatusBadge status={revisionStatus} />
          </div>
          <span className="text-xs text-text-muted">From run: {changeRequest.run_id}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Reason</div>
          <p className="text-sm text-text-secondary">{changeRequest.reason}</p>
        </div>

        <div>
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Suggested Changes</div>
          <ul className="space-y-1 text-sm">
            {addCount > 0 && (
              <li className="flex items-center gap-2 text-success">
                <span className="w-4 text-center font-mono font-bold">+</span>
                {addCount} step{addCount > 1 ? 's' : ''} to add
              </li>
            )}
            {modifyCount > 0 && (
              <li className="flex items-center gap-2 text-accent-cyan">
                <span className="w-4 text-center font-mono font-bold">~</span>
                {modifyCount} step{modifyCount > 1 ? 's' : ''} to modify
              </li>
            )}
            {removeCount > 0 && (
              <li className="flex items-center gap-2 text-error">
                <span className="w-4 text-center font-mono font-bold">-</span>
                {removeCount} step{removeCount > 1 ? 's' : ''} to remove
              </li>
            )}
          </ul>
        </div>

        <div className="bg-bg-secondary rounded-lg p-3">
          <ChangesPreview
            suggestedChanges={suggested_changes}
            currentSteps={currentSteps}
          />
        </div>

        {showRejectForm ? (
          <div className="space-y-3 pt-2">
            <div>
              <label
                htmlFor={`reject-reason-${changeRequest.change_request_id}`}
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Reason for rejection (optional):
              </label>
              <textarea
                id={`reject-reason-${changeRequest.change_request_id}`}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this change request is being rejected..."
                rows={2}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded-md hover:bg-bg-hover transition-colors"
                onClick={handleCancelReject}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-error text-white rounded-md hover:shadow-[0_0_20px_rgba(255,71,87,0.3)] transition-all disabled:opacity-50"
                onClick={handleReject}
                disabled={isLoading}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        ) : revisionStatus === 'drafted' && changeRequest.result_version ? (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              className="text-sm text-accent-cyan hover:underline"
              onClick={() => onViewDiff(changeRequest)}
              disabled={isLoading}
            >
              View AI Changes
            </button>
            {onEditDraft && (
              <button
                className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded-md hover:bg-bg-hover transition-colors disabled:opacity-50"
                onClick={() => onEditDraft(changeRequest.change_request_id, changeRequest.result_version!)}
                disabled={isLoading}
              >
                Edit Draft
              </button>
            )}
            {onRejectRevision && (
              <button
                className="px-3 py-1.5 text-sm bg-error/10 text-error rounded-md hover:bg-error/20 transition-colors disabled:opacity-50"
                onClick={() => onRejectRevision(changeRequest.change_request_id)}
                disabled={isLoading}
              >
                Reject AI Draft
              </button>
            )}
            {onAcceptRevision && (
              <button
                className="px-3 py-1.5 text-sm bg-accent-cyan text-bg-deep font-medium rounded-md hover:shadow-glow-cyan transition-all disabled:opacity-50"
                onClick={() => onAcceptRevision(changeRequest.change_request_id)}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Accept AI Draft'}
              </button>
            )}
          </div>
        ) : revisionStatus === 'in_progress' || revisionStatus === 'pending' ? (
          <div className="flex justify-end pt-2">
            <button className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-muted rounded-md cursor-not-allowed" disabled>
              AI Analyzing...
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              className="text-sm text-accent-cyan hover:underline disabled:opacity-50"
              onClick={() => onViewDiff(changeRequest)}
              disabled={isLoading}
            >
              View Diff
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded-md hover:bg-bg-hover transition-colors disabled:opacity-50"
              onClick={handleReject}
              disabled={isLoading}
            >
              Reject
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-accent-cyan text-bg-deep font-medium rounded-md hover:shadow-glow-cyan transition-all disabled:opacity-50"
              onClick={handleAccept}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Accept & Create Draft'}
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-bg-primary border-t border-border-subtle">
        <span className="text-xs text-text-muted">
          Received: {new Date(changeRequest.created_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

interface ChangesPreviewProps {
  suggestedChanges: ChangeRequest['suggested_changes'];
  currentSteps: Step[];
}

function ChangesPreview({ suggestedChanges, currentSteps }: ChangesPreviewProps) {
  const { add_steps, modify_steps, remove_steps } = suggestedChanges;

  const getStepTitle = (stepId: string): string => {
    const step = currentSteps.find((s) => s.step_id === stepId);
    return step?.title || 'Unknown step';
  };

  return (
    <div className="space-y-3 text-sm">
      {add_steps && add_steps.length > 0 && (
        <div>
          <span className="text-xs font-medium text-success uppercase">Add:</span>
          <ul className="mt-1 space-y-0.5 text-text-secondary">
            {add_steps.map((step) => (
              <li key={step.step_id} className="pl-4 border-l-2 border-success/30">{step.title}</li>
            ))}
          </ul>
        </div>
      )}

      {modify_steps && modify_steps.length > 0 && (
        <div>
          <span className="text-xs font-medium text-accent-cyan uppercase">Modify:</span>
          <ul className="mt-1 space-y-0.5 text-text-secondary">
            {modify_steps.map((mod) => (
              <li key={mod.step_id} className="pl-4 border-l-2 border-accent-cyan/30">
                {getStepTitle(mod.step_id)}
                {mod.title && <span className="text-xs text-text-muted ml-1">(title)</span>}
                {mod.dependencies && <span className="text-xs text-text-muted ml-1">(dependencies)</span>}
                {mod.description && <span className="text-xs text-text-muted ml-1">(description)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {remove_steps && remove_steps.length > 0 && (
        <div>
          <span className="text-xs font-medium text-error uppercase">Remove:</span>
          <ul className="mt-1 space-y-0.5 text-text-secondary">
            {remove_steps.map((stepId) => (
              <li key={stepId} className="pl-4 border-l-2 border-error/30">{getStepTitle(stepId)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface RevisionStatusBadgeProps {
  status: RevisionStatus;
}

function RevisionStatusBadge({ status }: RevisionStatusBadgeProps) {
  switch (status) {
    case 'pending':
    case 'in_progress':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-accent-cyan/10 text-accent-cyan"
          title="AI is analyzing the change request"
        >
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          AI Analyzing...
        </span>
      );
    case 'drafted':
      return (
        <span
          className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success"
          title="AI draft ready for review"
        >
          Draft Ready
        </span>
      );
    case 'error':
      return (
        <span
          className="px-2 py-0.5 rounded text-xs font-medium bg-error/10 text-error"
          title="AI analysis failed"
        >
          AI Error
        </span>
      );
    case 'none':
    default:
      return (
        <span
          className="px-2 py-0.5 rounded text-xs font-medium bg-bg-tertiary text-text-secondary"
          title="Manual revision needed"
        >
          Manual
        </span>
      );
  }
}

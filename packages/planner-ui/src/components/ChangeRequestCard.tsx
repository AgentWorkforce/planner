import { useState } from 'react';
import type { ChangeRequest, Step, RevisionStatus } from '@/types';

interface ChangeRequestCardProps {
  /** Change request data */
  changeRequest: ChangeRequest;
  /** Current steps for context */
  currentSteps: Step[];
  /** Whether an action is in progress */
  isLoading?: boolean;
  /** Callback when user clicks "View Diff" */
  onViewDiff: (changeRequest: ChangeRequest) => void;
  /** Callback when user accepts the original change request */
  onAccept: (changeRequestId: string) => void;
  /** Callback when user rejects the original change request */
  onReject: (changeRequestId: string, reason?: string) => void;
  /** Callback when user accepts the AI revision (rcra008) */
  onAcceptRevision?: (changeRequestId: string) => void;
  /** Callback when user rejects the AI revision (rcra008) */
  onRejectRevision?: (changeRequestId: string) => void;
  /** Callback when user wants to edit the draft (rcra008) */
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
    <div className="change-request-card">
      <div className="change-request-card-header">
        <span className="change-request-card-icon" aria-hidden="true">
          ⚠️
        </span>
        <div className="change-request-card-title">
          <h4>Change Request</h4>
          <span className="change-request-card-source">From run: {changeRequest.run_id}</span>
        </div>
        <RevisionStatusBadge status={revisionStatus} />
      </div>

      <div className="change-request-card-reason">
        <strong>Reason:</strong>
        <p>{changeRequest.reason}</p>
      </div>

      <div className="change-request-card-summary">
        <strong>Suggested changes:</strong>
        <ul className="change-request-changes-list">
          {addCount > 0 && (
            <li className="change-add">
              <span className="change-icon">+</span>
              {addCount} step{addCount > 1 ? 's' : ''} to add
            </li>
          )}
          {modifyCount > 0 && (
            <li className="change-modify">
              <span className="change-icon">~</span>
              {modifyCount} step{modifyCount > 1 ? 's' : ''} to modify
            </li>
          )}
          {removeCount > 0 && (
            <li className="change-remove">
              <span className="change-icon">-</span>
              {removeCount} step{removeCount > 1 ? 's' : ''} to remove
            </li>
          )}
        </ul>
      </div>

      <div className="change-request-card-preview">
        <ChangesPreview
          suggestedChanges={suggested_changes}
          currentSteps={currentSteps}
        />
      </div>

      {showRejectForm ? (
        <div className="change-request-reject-form">
          <label htmlFor={`reject-reason-${changeRequest.change_request_id}`}>
            Reason for rejection (optional):
          </label>
          <textarea
            id={`reject-reason-${changeRequest.change_request_id}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this change request is being rejected..."
            rows={2}
          />
          <div className="change-request-reject-actions">
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
      ) : revisionStatus === 'drafted' && changeRequest.result_version ? (
        // Show revision review actions when AI draft is ready
        <div className="change-request-card-actions">
          <button
            className="btn btn-sm btn-link"
            onClick={() => onViewDiff(changeRequest)}
            disabled={isLoading}
          >
            View AI Changes
          </button>
          {onEditDraft && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onEditDraft(changeRequest.change_request_id, changeRequest.result_version!)}
              disabled={isLoading}
            >
              Edit Draft
            </button>
          )}
          {onRejectRevision && (
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onRejectRevision(changeRequest.change_request_id)}
              disabled={isLoading}
            >
              Reject AI Draft
            </button>
          )}
          {onAcceptRevision && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onAcceptRevision(changeRequest.change_request_id)}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Accept AI Draft'}
            </button>
          )}
        </div>
      ) : revisionStatus === 'in_progress' || revisionStatus === 'pending' ? (
        // AI is analyzing - show disabled state
        <div className="change-request-card-actions">
          <button className="btn btn-sm btn-secondary" disabled>
            AI Analyzing...
          </button>
        </div>
      ) : (
        // Default: manual revision or no agent spawned
        <div className="change-request-card-actions">
          <button
            className="btn btn-sm btn-link"
            onClick={() => onViewDiff(changeRequest)}
            disabled={isLoading}
          >
            View Diff
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleReject}
            disabled={isLoading}
          >
            Reject
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Accept & Create Draft'}
          </button>
        </div>
      )}

      <div className="change-request-card-meta">
        <span className="change-request-card-time">
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

/**
 * Preview of suggested changes.
 */
function ChangesPreview({ suggestedChanges, currentSteps }: ChangesPreviewProps) {
  const { add_steps, modify_steps, remove_steps } = suggestedChanges;

  const getStepTitle = (stepId: string): string => {
    const step = currentSteps.find((s) => s.step_id === stepId);
    return step?.title || 'Unknown step';
  };

  return (
    <div className="changes-preview">
      {add_steps && add_steps.length > 0 && (
        <div className="preview-section preview-add">
          <span className="preview-label">Add:</span>
          <ul>
            {add_steps.map((step) => (
              <li key={step.step_id}>{step.title}</li>
            ))}
          </ul>
        </div>
      )}

      {modify_steps && modify_steps.length > 0 && (
        <div className="preview-section preview-modify">
          <span className="preview-label">Modify:</span>
          <ul>
            {modify_steps.map((mod) => (
              <li key={mod.step_id}>
                {getStepTitle(mod.step_id)}
                {mod.title && <span className="mod-detail"> (title)</span>}
                {mod.dependencies && <span className="mod-detail"> (dependencies)</span>}
                {mod.description && <span className="mod-detail"> (description)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {remove_steps && remove_steps.length > 0 && (
        <div className="preview-section preview-remove">
          <span className="preview-label">Remove:</span>
          <ul>
            {remove_steps.map((stepId) => (
              <li key={stepId}>{getStepTitle(stepId)}</li>
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

/**
 * Badge showing AI revision agent status (rcra007).
 */
function RevisionStatusBadge({ status }: RevisionStatusBadgeProps) {
  switch (status) {
    case 'pending':
    case 'in_progress':
      return (
        <span className="revision-status-badge revision-status--analyzing" title="AI is analyzing the change request">
          <span className="spinner-small" aria-hidden="true" />
          AI Analyzing...
        </span>
      );
    case 'drafted':
      return (
        <span className="revision-status-badge revision-status--drafted" title="AI draft ready for review">
          Draft Ready
        </span>
      );
    case 'error':
      return (
        <span className="revision-status-badge revision-status--error" title="AI analysis failed">
          AI Error
        </span>
      );
    case 'none':
    default:
      return (
        <span className="revision-status-badge revision-status--manual" title="Manual revision needed">
          Manual
        </span>
      );
  }
}

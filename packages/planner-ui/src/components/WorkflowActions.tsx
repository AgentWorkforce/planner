import { useState, useCallback } from 'react';
import type { PlanVersion } from '@/types';

interface WorkflowActionsProps {
  version: PlanVersion;
  onSubmit: () => Promise<void>;
  onApprove: (approver: string) => Promise<void>;
  onPublish: () => Promise<void>;
  currentUser?: string;
}

export function WorkflowActions({
  version,
  onSubmit,
  onApprove,
  onPublish,
  currentUser = 'User',
}: WorkflowActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approverName, setApproverName] = useState(currentUser);

  const handleSubmit = useCallback(async () => {
    setLoading('submit');
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(null);
    }
  }, [onSubmit]);

  const handleApprove = useCallback(async () => {
    if (!approverName.trim()) {
      setError('Approver name is required');
      return;
    }
    setLoading('approve');
    setError(null);
    try {
      await onApprove(approverName.trim());
      setShowApproveModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setLoading(null);
    }
  }, [onApprove, approverName]);

  const handlePublish = useCallback(async () => {
    setLoading('publish');
    setError(null);
    try {
      await onPublish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setLoading(null);
    }
  }, [onPublish]);

  const canSubmit = version.status === 'draft' && !version.submitted_at;
  const canApprove = version.status === 'draft' && version.submitted_at;
  const canPublish = version.status === 'approved';

  return (
    <div className="workflow-actions">
      {error && <div className="workflow-error">{error}</div>}

      <div className="workflow-status">
        <span className="workflow-status-label">Status:</span>
        <span className={`workflow-status-value status-${version.status}`}>
          {version.status}
          {version.submitted_at && version.status === 'draft' && ' (submitted)'}
        </span>
      </div>

      <div className="workflow-buttons">
        {canSubmit && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading !== null}
          >
            {loading === 'submit' ? 'Submitting...' : 'Submit for Review'}
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            className="btn btn-success"
            onClick={() => setShowApproveModal(true)}
            disabled={loading !== null}
          >
            {loading === 'approve' ? 'Approving...' : 'Approve'}
          </button>
        )}

        {canPublish && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={loading !== null}
          >
            {loading === 'publish' ? 'Publishing...' : 'Publish'}
          </button>
        )}

        {version.status === 'published' && (
          <span className="workflow-published-badge">
            Published - Ready for Orchestrator
          </span>
        )}
      </div>

      {version.approval_info && (
        <div className="workflow-approval-info">
          <span>Approved by {version.approval_info.approver}</span>
          <span>on {new Date(version.approval_info.approved_at).toLocaleString()}</span>
        </div>
      )}

      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Approve Plan</h3>
            <p>
              By approving this plan, you confirm that the steps and acceptance criteria are
              correct and ready for execution.
            </p>
            <div className="form-group">
              <label htmlFor="approver">Your Name</label>
              <input
                id="approver"
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowApproveModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleApprove}
                disabled={loading === 'approve'}
              >
                {loading === 'approve' ? 'Approving...' : 'Approve Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

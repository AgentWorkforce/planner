import { useState, useCallback } from 'react';
import type { PlanVersion } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ForgeConfigPanel } from '@plannr/shared-ui';
import type { ForgeConfig } from '@plannr/shared-ui';

interface WorkflowActionsProps {
  version: PlanVersion;
  onSubmit: () => Promise<void>;
  onApprove: (approver: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onStartBuild?: (config: ForgeConfig) => Promise<void>;
  currentUser?: string;
}

export function WorkflowActions({
  version,
  onSubmit,
  onApprove,
  onPublish,
  onStartBuild,
  currentUser = 'User',
}: WorkflowActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approverName, setApproverName] = useState(currentUser);
  const [buildSheetOpen, setBuildSheetOpen] = useState(false);

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

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'approved':
        return 'bg-success/10 text-success border-success/20';
      case 'published':
        return 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20';
      default:
        return 'bg-bg-tertiary text-text-secondary border-border-subtle';
    }
  };

  return (
    <div className="space-y-3 p-4 bg-bg-secondary rounded-xl border border-border-subtle">
      {error && (
        <div className="p-2 bg-error/10 border border-error/30 rounded-lg text-error text-xs">
          {error}
        </div>
      )}

      {/* Status badge - prominent */}
      <div
        className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold uppercase tracking-wide rounded-lg border ${getStatusBadgeClasses(version.status)}`}
      >
        {version.status}
      </div>

      {/* Approval info */}
      {version.approval_info && (
        <div className="text-xs text-text-muted">
          <div>Approved by {version.approval_info.approver}</div>
          <div>{new Date(version.approval_info.approved_at).toLocaleString()}</div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-1">
        {canSubmit && (
          <button
            type="button"
            className="w-full px-4 py-2 bg-accent-orange text-white font-medium rounded-lg transition-all duration-150 hover:shadow-glow-orange disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={loading !== null}
          >
            {loading === 'submit' ? 'Submitting...' : 'Submit for Review'}
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            className="w-full px-4 py-2 bg-success text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-green disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowApproveModal(true)}
            disabled={loading !== null}
          >
            {loading === 'approve' ? 'Approving...' : 'Approve'}
          </button>
        )}

        {canPublish && (
          <button
            type="button"
            className="w-full px-4 py-2 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePublish}
            disabled={loading !== null}
          >
            {loading === 'publish' ? 'Publishing...' : 'Publish'}
          </button>
        )}

        {version.status === 'published' && (
          <button
            type="button"
            className="w-full px-4 py-2 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setBuildSheetOpen(true)}
            disabled={loading !== null || !onStartBuild}
          >
            Start Build
          </button>
        )}
      </div>

      {showApproveModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setShowApproveModal(false)}
        >
          <div
            className="bg-bg-tertiary rounded-2xl shadow-modal max-w-md w-full mx-4 p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-text-primary mb-4">Approve Plan</h3>
            <p className="text-text-secondary text-sm mb-6">
              By approving this plan, you confirm that the steps and acceptance criteria are
              correct and ready for execution.
            </p>
            <div className="mb-6">
              <label htmlFor="approver" className="block text-sm font-medium text-text-secondary mb-1.5">
                Your Name
              </label>
              <input
                id="approver"
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-all duration-150 hover:border-border-light"
                onClick={() => setShowApproveModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-success text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-green disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleApprove}
                disabled={loading === 'approve'}
              >
                {loading === 'approve' ? 'Approving...' : 'Approve Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {onStartBuild && (
        <Sheet open={buildSheetOpen} onOpenChange={setBuildSheetOpen}>
          <SheetContent className="w-[480px] sm:w-[540px] bg-bg-secondary border-border-subtle overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-text-primary">Configure Build</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ForgeConfigPanel
                steps={(version as any).steps?.map((s: any) => ({
                  step_id: s.step_id,
                  title: s.title,
                  scope: s.scope,
                  owner_role: s.owner_role,
                })) ?? []}
                onStart={async (config) => {
                  await onStartBuild(config);
                  setBuildSheetOpen(false);
                }}
                onCancel={() => setBuildSheetOpen(false)}
                loading={loading === 'build'}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

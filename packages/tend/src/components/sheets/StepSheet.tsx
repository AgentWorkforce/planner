import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { TreeStep } from '../tree/ProjectTree';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
import { SendIcon } from '@/components/icons';

export interface StepSheetProps {
  step: TreeStep;
  onUpdate?: (stepId: string, updates: Partial<TreeStep>) => Promise<void>;
  onSendMessage?: (message: string, stepContext: { step_id: string; title: string }) => void;
  disabled?: boolean;
}

/**
 * StepSheet - Full step detail view
 *
 * Sections:
 * - Header: title (editable) + status badge
 * - Description (editable)
 * - Scope (read-only badge)
 * - Owner role (read-only)
 * - Dependencies list
 * - Acceptance criteria checklist
 *
 * Display patterns copied from planner-ui StepEditor.
 * Read-only by default, edit mode available when onUpdate provided.
 */
export function StepSheet({ step, onUpdate, onSendMessage, disabled = false }: StepSheetProps) {
  const [saving, setSaving] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const isEditable = !disabled && !saving && onUpdate !== undefined;

  const handleUpdate = useCallback(
    async (field: keyof TreeStep, value: unknown) => {
      if (!onUpdate) return;
      setSaving(true);
      try {
        await onUpdate(step.step_id, { [field]: value });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, step.step_id]
  );

  // Status config
  const statusConfig = {
    pending: { label: 'Pending', className: 'bg-bg-tertiary text-text-muted' },
    running: { label: 'Running', className: 'bg-accent-light text-accent-primary' },
    done: { label: 'Done', className: 'bg-success-light text-success' },
    blocked: { label: 'Blocked', className: 'bg-warning-light text-warning' },
    failed: { label: 'Failed', className: 'bg-error-light text-error' },
  };

  const status = step.execution_status || 'pending';
  const { label: statusLabel, className: statusClassName } = statusConfig[status];

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim() || !onSendMessage) return;

    onSendMessage(chatInput.trim(), {
      step_id: step.step_id,
      title: step.title,
    });

    setChatInput('');
  }, [chatInput, onSendMessage, step.step_id, step.title]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleCriterionUpdate = useCallback(
    (criterionId: string, newDescription: string) => {
      if (!onUpdate) return;
      const updatedCriteria = (step.acceptance_criteria || []).map((c) =>
        c.id === criterionId ? { ...c, description: newDescription } : c
      );
      handleUpdate('acceptance_criteria', updatedCriteria);
    },
    [onUpdate, step.acceptance_criteria, handleUpdate]
  );

  const handleAddCriterion = useCallback(() => {
    if (!onUpdate) return;
    const newCriterion = { id: `ac-${Date.now()}`, description: '', type: 'manual' };
    const updated = [...(step.acceptance_criteria || []), newCriterion];
    handleUpdate('acceptance_criteria', updated);
  }, [onUpdate, step.acceptance_criteria, handleUpdate]);

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Header Section */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {isEditable ? (
              <EditableText
                value={step.title}
                onSave={(value) => handleUpdate('title', value)}
                placeholder="Enter step title..."
                disabled={!isEditable}
                className="text-xl font-semibold text-text-primary"
                as="h3"
              />
            ) : (
              <h3 className="text-xl font-semibold text-text-primary">{step.title}</h3>
            )}
          </div>
          <span className={`flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>

        {saving && <span className="text-xs text-accent-primary animate-pulse">Saving...</span>}
      </div>

      {/* Attention Required — escalation panel */}
      {step.escalation && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">⚡</span>
            <h4 className="text-sm font-semibold text-amber-400">Attention Required</h4>
          </div>
          <p className="text-sm text-text-primary">{step.escalation.detail}</p>

          {/* Gate actions */}
          {step.escalation.type === 'gate' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
                onClick={() => {}}
              >
                Approve
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium bg-accent-secondary/20 text-accent-secondary rounded hover:bg-accent-secondary/30 transition-colors"
                onClick={() => {}}
              >
                Reject
              </button>
            </div>
          )}

          {/* Question actions */}
          {step.escalation.type === 'question' && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Type your answer..."
                className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
                  onClick={() => {}}
                >
                  Answer
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary text-text-muted rounded hover:bg-bg-elevated transition-colors"
                  onClick={() => {}}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Stall actions */}
          {step.escalation.type === 'stall' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
                onClick={() => {}}
              >
                Cancel &amp; Retry
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary text-text-muted rounded hover:bg-bg-elevated transition-colors"
                onClick={() => {}}
              >
                Skip Step
              </button>
            </div>
          )}

          {/* Retries exhausted actions */}
          {step.escalation.type === 'retries_exhausted' && (
            <div className="space-y-2">
              {step.retryHints && step.retryHints.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-1">Recovery Guidance</p>
                  <ul className="space-y-0.5">
                    {step.retryHints.map((hint, i) => (
                      <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                        <span className="flex-shrink-0 mt-0.5">→</span>
                        <span>{hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
                  onClick={() => {}}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary text-text-muted rounded hover:bg-bg-elevated transition-colors"
                  onClick={() => {}}
                >
                  Skip Step
                </button>
              </div>
            </div>
          )}

          {/* Low quality actions */}
          {step.escalation.type === 'low_quality' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
                onClick={() => {}}
              >
                Retry Step
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary text-text-muted rounded hover:bg-bg-elevated transition-colors"
                onClick={() => {}}
              >
                Accept Anyway
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scope & Owner Role - side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Scope
          </label>
          {step.scope ? (
            <span className="inline-block px-2.5 py-1 text-sm bg-bg-elevated text-text-primary rounded border border-border-subtle">
              {step.scope}
            </span>
          ) : (
            <span className="text-sm text-text-muted italic">No scope assigned</span>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
            Owner Role
          </label>
          {step.owner_role ? (
            <span className="text-sm text-text-primary">{step.owner_role}</span>
          ) : (
            <span className="text-sm text-text-muted italic">No owner assigned</span>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Description
        </label>
        {isEditable ? (
          <EditableTextarea
            value={step.description || ''}
            onSave={(value) => handleUpdate('description', value)}
            placeholder="Describe what needs to be done..."
            disabled={!isEditable}
            rows={4}
          />
        ) : (
          <div className="text-sm text-text-primary whitespace-pre-wrap">
            {step.description || <span className="text-text-muted italic">No description provided</span>}
          </div>
        )}
      </div>

      {/* Dependencies */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Dependencies
        </label>
        {step.dependencies && step.dependencies.length > 0 ? (
          <div className="space-y-1.5">
            {step.dependencies.map((depId) => (
              <div
                key={depId}
                className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-md text-sm text-text-primary"
              >
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent-primary" />
                <span className="flex-1 font-mono text-xs text-text-muted">{depId}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-text-muted italic">No dependencies</div>
        )}
      </div>

      {/* Acceptance Criteria */}
      <div>
        <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
          Acceptance Criteria
        </label>
        {step.acceptance_criteria && step.acceptance_criteria.length > 0 ? (
          <ul className="space-y-2">
            {step.acceptance_criteria.map((criterion, index) => (
              <li key={criterion.id || index} className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5 text-xs">•</span>
                {isEditable ? (
                  <input
                    type="text"
                    defaultValue={criterion.description}
                    onBlur={(e) => {
                      if (e.target.value !== criterion.description) {
                        handleCriterionUpdate(criterion.id, e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="flex-1 text-sm text-text-primary bg-transparent border-b border-transparent hover:border-border-subtle focus:border-accent-primary focus:outline-none transition-colors py-0.5"
                  />
                ) : (
                  <span className="flex-1 text-sm text-text-primary">{criterion.description}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-text-muted italic">No acceptance criteria defined</div>
        )}
        {isEditable && (
          <button
            type="button"
            onClick={handleAddCriterion}
            className="mt-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            + Add criterion
          </button>
        )}
      </div>

      {/* Quality Score — shown when step has been scored */}
      {step.score !== undefined && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Quality</h4>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'text-2xl font-mono tabular-nums',
                step.score >= 80 ? 'text-success' : step.score >= 50 ? 'text-text-primary' : 'text-accent-secondary'
              )}
            >
              {step.score}
            </div>
            <div className="flex-1">
              <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    step.score >= 80 ? 'bg-success' : step.score >= 50 ? 'bg-accent-primary' : 'bg-accent-secondary'
                  )}
                  style={{ width: `${step.score}%` }}
                />
              </div>
            </div>
          </div>
          {step.scoreReasoning && (
            <p className="text-xs text-text-muted">{step.scoreReasoning}</p>
          )}
          {/* Matched / failed criteria breakdown */}
          {((step.matchedCriteria && step.matchedCriteria.length > 0) || (step.failedCriteria && step.failedCriteria.length > 0)) && (
            <div className="space-y-1 pt-1">
              {step.matchedCriteria && step.matchedCriteria.length > 0 && (
                <div className="space-y-0.5">
                  {step.matchedCriteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-success">
                      <span className="flex-shrink-0 mt-0.5">✓</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}
              {step.failedCriteria && step.failedCriteria.length > 0 && (
                <div className="space-y-0.5">
                  {step.failedCriteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-accent-secondary">
                      <span className="flex-shrink-0 mt-0.5">✗</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Execution Metrics — shown when step has timing / cost data */}
      {(step.estimatedCostUsd !== undefined || step.durationMs !== undefined || step.model) && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Execution</h4>
          <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
            {step.model && <span>Model: {step.model}</span>}
            {step.durationMs !== undefined && (
              <span>
                Duration:{' '}
                {step.durationMs < 60000
                  ? `${Math.round(step.durationMs / 1000)}s`
                  : `${Math.round(step.durationMs / 60000)}m`}
              </span>
            )}
            {step.estimatedCostUsd !== undefined && (
              <span>Est. cost: ${step.estimatedCostUsd.toFixed(3)}</span>
            )}
          </div>
        </div>
      )}

      {/* Merge — shown for completed steps with merge info */}
      {(step.mergeStrategy || step.mergeStatus) && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Merge</h4>
          <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
            {step.mergeStrategy && <span>Strategy: {step.mergeStrategy}</span>}
            {step.mergeStatus && (
              <span className={cn(
                step.mergeStatus === 'merged' ? 'text-success' :
                step.mergeStatus === 'failed' ? 'text-accent-secondary' :
                step.mergeStatus === 'merging' ? 'text-accent-primary' :
                'text-text-muted'
              )}>
                Status: {step.mergeStatus}
              </span>
            )}
            {step.mergeBranch && <span>Branch: {step.mergeBranch}</span>}
            {step.mergeTargetBranch && <span>Target: {step.mergeTargetBranch}</span>}
          </div>
          {step.mergeError && (
            <div className="mt-1 px-2 py-1 bg-accent-secondary/10 border border-accent-secondary/20 rounded text-xs text-accent-secondary font-mono">
              {step.mergeError}
            </div>
          )}
        </div>
      )}

      {/* Failure History — shown when step has accumulated failures */}
      {step.failures && step.failures.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Failures ({step.failures.length})
          </h4>
          <ul className="space-y-1">
            {step.failures.map((failure, i) => (
              <li
                key={i}
                className="text-xs text-accent-secondary bg-bg-tertiary rounded px-2 py-1 font-mono"
              >
                {failure}
              </li>
            ))}
          </ul>
          {step.retryHints && step.retryHints.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border-subtle">
              <p className="text-xs font-medium text-text-secondary mb-1">Recovery Guidance</p>
              <ul className="space-y-0.5">
                {step.retryHints.map((hint, i) => (
                  <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                    <span className="flex-shrink-0 mt-0.5">→</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Execution Info - only shown when step has execution data */}
      {step.execution_status && step.execution_status !== 'pending' && (
        <div className="pt-6 border-t border-border-subtle">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Execution Info</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Status
                </label>
                <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded ${statusClassName}`}>
                  {statusLabel}
                </span>
              </div>
              {step.model ? (
                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Model
                  </label>
                  <span className="text-sm text-text-primary font-mono">{step.model}</span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Agent
                  </label>
                  <span className="text-sm text-text-muted italic">Not assigned</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                Duration
              </label>
              {step.durationMs !== undefined ? (
                <span className="text-sm text-text-primary">
                  {step.durationMs < 60000
                    ? `${Math.round(step.durationMs / 1000)}s`
                    : `${Math.round(step.durationMs / 60000)}m`}
                </span>
              ) : (
                <span className="text-sm text-text-muted italic">Not started</span>
              )}
            </div>
            {/* Error details - shown only if failed */}
            {step.execution_status === 'failed' && step.error && (
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Error
                </label>
                <div className="px-3 py-2 bg-error-light border border-error rounded-md text-sm text-error font-mono">
                  {step.error}
                </div>
              </div>
            )}
            {step.execution_status === 'failed' && !step.error && (
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Error
                </label>
                <div className="px-3 py-2 bg-error-light border border-error rounded-md text-sm text-error">
                  <span className="italic">Error details not available</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Traceability */}
      <div className="mt-6 pt-4 border-t border-border-subtle">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          Origin
        </h4>
        {step.source_block_id ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary/50">
              <span className="text-base">💭</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  From ideation block
                </p>
                <p className="text-xs text-text-muted font-mono truncate">
                  {step.source_block_id}
                </p>
              </div>
            </div>
            {step.created_at && (
              <p className="text-xs text-text-muted pl-3">
                Created {new Date(step.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted italic">
            Created during planning
          </p>
        )}
      </div>

      {/* Focused chat input - bottom section */}
      {onSendMessage && (
        <div className="pt-6 mt-6 border-t border-border-subtle">
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
            Ask about this step
          </label>
          <div className="flex gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question about this step..."
              rows={2}
              className="flex-1 px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-muted focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 outline-none resize-none transition-colors"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
              className="flex-shrink-0 px-4 py-2 bg-accent-primary text-text-inverse rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send message (Cmd/Ctrl+Enter)"
            >
              <SendIcon size="md" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-text-muted">
            Messages sent from here will appear in the main conversation with step context.
          </p>
        </div>
      )}
    </div>
  );
}

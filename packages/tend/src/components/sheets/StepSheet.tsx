import { useState, useCallback } from 'react';
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
              {/* Agent assignment placeholder - will be populated when execution data available */}
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                  Agent
                </label>
                <span className="text-sm text-text-muted italic">Not assigned</span>
              </div>
            </div>
            {/* Time tracking placeholder - will be populated when execution data available */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                Duration
              </label>
              <span className="text-sm text-text-muted italic">Not started</span>
            </div>
            {/* Error details - shown only if failed */}
            {step.execution_status === 'failed' && (
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

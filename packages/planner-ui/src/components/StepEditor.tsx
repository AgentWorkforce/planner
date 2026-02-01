import { useState, useCallback, useMemo } from 'react';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
import { DependencyIndicator, type ConnectedStep, type DependencyDirection } from './DependencyIndicator';
import { ChevronIcon, TrashIcon, MessageIcon, CloseIcon, PlusIcon } from './icons';
import type { Step } from '@/types';

const COMMON_ROLES = [
  'backend:Coder',
  'frontend:Coder',
  'fullstack:Coder',
  'devops:Engineer',
  'qa:Tester',
];

interface OwnerRoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function OwnerRoleSelector({ value, onChange, disabled }: OwnerRoleSelectorProps) {
  const [isCustom, setIsCustom] = useState(!COMMON_ROLES.includes(value) && value !== '');

  if (isCustom) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom role..."
          disabled={disabled}
        />
        <button
          type="button"
          className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-all duration-150 hover:border-border-light disabled:opacity-50"
          onClick={() => {
            setIsCustom(false);
            onChange('');
          }}
          disabled={disabled}
        >
          Use preset
        </button>
      </div>
    );
  }

  return (
    <select
      className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
      value={value}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setIsCustom(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
      disabled={disabled}
    >
      <option value="">Select role...</option>
      {COMMON_ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
      <option value="__custom__">Custom...</option>
    </select>
  );
}

interface StepEditorProps {
  step: Step;
  allSteps: Step[];
  onUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  onDelete: (stepId: string) => Promise<void>;
  disabled?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  commentCount?: number;
  onOpenComments?: (stepId: string) => void;
  /** Called when hovering a dependency indicator */
  onIndicatorHover?: (direction: DependencyDirection | null) => void;
  /** Called when clicking a dependency indicator - scrolls to first connected step */
  onScrollToStep?: (stepId: string) => void;
  /** Whether this step card is being hovered (for indicator expansion) */
  isHovered?: boolean;
}

export function StepEditor({
  step,
  allSteps,
  onUpdate,
  onDelete,
  disabled = false,
  isExpanded = false,
  onToggleExpand,
  commentCount = 0,
  onOpenComments,
  onIndicatorHover,
  onScrollToStep,
  isHovered = false,
}: StepEditorProps) {
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Compute dependency info for indicators
  const { incomingSteps, outgoingSteps, hasCrossScopeIncoming, hasCrossScopeOutgoing } = useMemo(() => {
    const incoming: ConnectedStep[] = [];
    const outgoing: ConnectedStep[] = [];
    let crossScopeIn = false;
    let crossScopeOut = false;

    const stepScope = step.scope || '';

    // Incoming: steps this step depends on
    for (const depId of step.dependencies || []) {
      const depStep = allSteps.find((s) => s.step_id === depId);
      if (depStep) {
        incoming.push({
          stepId: depStep.step_id,
          title: depStep.title,
          scope: depStep.scope,
        });
        if ((depStep.scope || '') !== stepScope) {
          crossScopeIn = true;
        }
      }
    }

    // Outgoing: steps that depend on this step
    for (const s of allSteps) {
      if (s.dependencies?.includes(step.step_id)) {
        outgoing.push({
          stepId: s.step_id,
          title: s.title,
          scope: s.scope,
        });
        if ((s.scope || '') !== stepScope) {
          crossScopeOut = true;
        }
      }
    }

    return {
      incomingSteps: incoming,
      outgoingSteps: outgoing,
      hasCrossScopeIncoming: crossScopeIn,
      hasCrossScopeOutgoing: crossScopeOut,
    };
  }, [step, allSteps]);

  const handleUpdate = useCallback(
    async (field: keyof Step, value: unknown) => {
      setSaving(true);
      try {
        await onUpdate(step.step_id, { [field]: value });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, step.step_id]
  );

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(step.step_id);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }, [onDelete, step.step_id, confirmDelete]);

  const cancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  const isEditable = !disabled && !saving;

  const availableDeps = allSteps.filter(
    (s) => s.step_id !== step.step_id && !s.dependencies.includes(step.step_id)
  );

  return (
    <div
      className={`relative bg-bg-card rounded-lg border transition-colors ${
        isExpanded ? 'border-accent-cyan/30' : 'border-border-subtle hover:border-border'
      }`}
    >
      {/* Dependency Indicators */}
      <DependencyIndicator
        direction="incoming"
        count={incomingSteps.length}
        hasCrossScope={hasCrossScopeIncoming}
        connectedSteps={incomingSteps}
        onHover={(hovered) => onIndicatorHover?.(hovered ? 'incoming' : null)}
        onClick={() => incomingSteps[0] && onScrollToStep?.(incomingSteps[0].stepId)}
        isParentHovered={isHovered}
      />
      <DependencyIndicator
        direction="outgoing"
        count={outgoingSteps.length}
        hasCrossScope={hasCrossScopeOutgoing}
        connectedSteps={outgoingSteps}
        onHover={(hovered) => onIndicatorHover?.(hovered ? 'outgoing' : null)}
        onClick={() => outgoingSteps[0] && onScrollToStep?.(outgoingSteps[0].stepId)}
        isParentHovered={isHovered}
      />

      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <ChevronIcon size="sm" direction={isExpanded ? 'down' : 'right'} />
        </button>

        <div className="flex-1 min-w-0">
          <EditableText
            value={step.title}
            onSave={(value) => handleUpdate('title', value)}
            placeholder="Enter step title..."
            disabled={!isEditable}
            className="text-sm font-medium text-text-primary"
          />
        </div>

        {step.scope && (
          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-bg-elevated text-text-secondary rounded">
            {step.scope}
          </span>
        )}

        {onOpenComments && (
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-text-muted hover:text-accent-cyan transition-colors"
            onClick={() => onOpenComments(step.step_id)}
            title={commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add comment'}
          >
            <MessageIcon size="sm" />
            {commentCount > 0 && (
              <span className="text-xs font-medium text-accent-cyan">{commentCount}</span>
            )}
          </button>
        )}

        {saving && (
          <span className="flex-shrink-0 text-xs text-accent-cyan animate-pulse">Saving...</span>
        )}

        {!disabled && (
          <div className="flex-shrink-0 flex items-center gap-1">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-error text-white font-medium rounded transition-all duration-150 hover:shadow-[0_0_10px_rgba(255,71,87,0.3)]"
                  onClick={handleDelete}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-bg-elevated text-text-secondary font-medium rounded transition-colors hover:text-text-primary"
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="p-1 text-text-muted hover:text-error transition-colors"
                onClick={handleDelete}
                title="Delete step"
              >
                <TrashIcon size="sm" />
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-4 border-t border-border-subtle">
          {/* Description */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Description
            </label>
            <EditableTextarea
              value={step.description || ''}
              onSave={(value) => handleUpdate('description', value)}
              placeholder="Describe what needs to be done..."
              disabled={!isEditable}
              rows={3}
            />
          </div>

          {/* Scope & Owner Role - side by side */}
          <div className="grid grid-cols-2 gap-6 mb-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Scope
              </label>
              <EditableText
                value={step.scope || ''}
                onSave={(value) => handleUpdate('scope', value)}
                placeholder="e.g., api-service, frontend"
                disabled={!isEditable}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Owner Role
              </label>
              <OwnerRoleSelector
                value={step.owner_role || ''}
                onChange={(value) => handleUpdate('owner_role', value)}
                disabled={!isEditable}
              />
            </div>
          </div>

          {/* Dependencies */}
          {(step.dependencies.length > 0 || (!disabled && availableDeps.length > 0)) && (
            <div className="mb-5">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Dependencies
              </label>
              {step.dependencies.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {step.dependencies.map((depId) => {
                    const depStep = allSteps.find((s) => s.step_id === depId);
                    return (
                      <span
                        key={depId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bg-elevated text-text-secondary text-xs rounded-md"
                      >
                        {depStep?.title || depId}
                        {!disabled && (
                          <button
                            type="button"
                            className="text-text-muted hover:text-error transition-colors"
                            onClick={() =>
                              handleUpdate(
                                'dependencies',
                                step.dependencies.filter((d) => d !== depId)
                              )
                            }
                            title="Remove dependency"
                          >
                            <CloseIcon size="sm" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              {!disabled && availableDeps.length > 0 && (
                <select
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !step.dependencies.includes(e.target.value)) {
                      handleUpdate('dependencies', [...step.dependencies, e.target.value]);
                    }
                  }}
                >
                  <option value="">Add dependency...</option>
                  {availableDeps.map((s) => (
                    <option key={s.step_id} value={s.step_id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Acceptance Criteria */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
              Acceptance Criteria
            </label>
            <div className="space-y-1">
              {(step.acceptance_criteria || []).map((criterion) => (
                <div
                  key={criterion.id}
                  className="group flex items-center gap-3 px-3 py-2 bg-bg-secondary rounded-md hover:bg-bg-elevated transition-colors"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-text-muted/50 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-transparent" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <EditableText
                      value={criterion.description}
                      onSave={(value) => {
                        const updated = (step.acceptance_criteria || []).map((c) =>
                          c.id === criterion.id ? { ...c, description: value } : c
                        );
                        handleUpdate('acceptance_criteria', updated);
                      }}
                      placeholder="Enter criterion..."
                      disabled={!isEditable}
                      className="text-sm"
                    />
                  </div>
                  {criterion.type && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-bg-tertiary text-text-muted rounded">
                      {criterion.type}
                    </span>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all"
                      onClick={() => {
                        const updated = (step.acceptance_criteria || []).filter(
                          (c) => c.id !== criterion.id
                        );
                        handleUpdate('acceptance_criteria', updated);
                      }}
                      title="Remove criterion"
                    >
                      <CloseIcon size="sm" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!disabled && (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-cyan hover:bg-accent-cyan/10 rounded-md transition-colors"
                onClick={() => {
                  const newCriterion = {
                    id: crypto.randomUUID(),
                    description: '',
                  };
                  const updated = [...(step.acceptance_criteria || []), newCriterion];
                  handleUpdate('acceptance_criteria', updated);
                }}
              >
                <PlusIcon size="sm" />
                Add Criterion
              </button>
            )}
          </div>

          {/* Gate */}
          <div className="pt-4 border-t border-border-subtle">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
              Approval Gate
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!step.gate}
                disabled={disabled}
                className="w-4 h-4 rounded border-border-subtle bg-bg-secondary text-accent-cyan focus:ring-accent-cyan/50"
                onChange={(e) => {
                  if (e.target.checked) {
                    handleUpdate('gate', { type: 'human_approval' });
                  } else {
                    handleUpdate('gate', undefined);
                  }
                }}
              />
              <span className="text-sm text-text-primary">Require human approval before proceeding</span>
            </label>
            {step.gate && (
              <div className="mt-3 ml-7">
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Approver Role (optional)
                </label>
                <EditableText
                  value={step.gate.approver_role || ''}
                  onSave={(value) => {
                    handleUpdate('gate', {
                      ...step.gate,
                      approver_role: value || undefined,
                    });
                  }}
                  placeholder="e.g., tech-lead"
                  disabled={!isEditable}
                  className="text-sm max-w-xs"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

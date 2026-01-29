import { useState, useCallback } from 'react';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
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
      <div className="owner-role-custom">
        <input
          type="text"
          className="owner-role-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom role..."
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
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
      className="owner-role-select"
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
}: StepEditorProps) {
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  // Get available dependencies (all steps except this one and steps that depend on this one)
  const availableDeps = allSteps.filter(
    (s) => s.step_id !== step.step_id && !s.dependencies.includes(step.step_id)
  );

  return (
    <div className={`step-editor ${isExpanded ? 'expanded' : ''}`}>
      <div className="step-editor-header">
        <button
          type="button"
          className="step-expand-btn"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>

        <div className="step-editor-title">
          <EditableText
            value={step.title}
            onSave={(value) => handleUpdate('title', value)}
            placeholder="Enter step title..."
            disabled={!isEditable}
            className="step-title-input"
          />
        </div>

        {step.scope && <span className="step-scope-badge">{step.scope}</span>}

        {onOpenComments && (
          <button
            type="button"
            className="step-comment-btn"
            onClick={() => onOpenComments(step.step_id)}
            title={commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add comment'}
          >
            <span className="comment-icon">💬</span>
            {commentCount > 0 && <span className="comment-badge">{commentCount}</span>}
          </button>
        )}

        {saving && <span className="saving-indicator">Saving...</span>}

        {!disabled && (
          <div className="step-actions">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleDelete}
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                title="Delete step"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="step-editor-body">
          <div className="step-field">
            <label className="step-field-label">Description</label>
            <EditableTextarea
              value={step.description || ''}
              onSave={(value) => handleUpdate('description', value)}
              placeholder="Describe what needs to be done..."
              disabled={!isEditable}
              rows={3}
            />
          </div>

          <div className="step-field-row">
            <div className="step-field">
              <label className="step-field-label">Scope</label>
              <EditableText
                value={step.scope || ''}
                onSave={(value) => handleUpdate('scope', value)}
                placeholder="e.g., api-service, frontend"
                disabled={!isEditable}
              />
            </div>

            <div className="step-field">
              <label className="step-field-label">Owner Role</label>
              <OwnerRoleSelector
                value={step.owner_role || ''}
                onChange={(value) => handleUpdate('owner_role', value)}
                disabled={!isEditable}
              />
            </div>
          </div>

          {step.dependencies.length > 0 && (
            <div className="step-field">
              <label className="step-field-label">Dependencies</label>
              <div className="step-dependencies-list">
                {step.dependencies.map((depId) => {
                  const depStep = allSteps.find((s) => s.step_id === depId);
                  return (
                    <span key={depId} className="dependency-chip">
                      {depStep?.title || depId}
                      {!disabled && (
                        <button
                          type="button"
                          className="dependency-remove"
                          onClick={() =>
                            handleUpdate(
                              'dependencies',
                              step.dependencies.filter((d) => d !== depId)
                            )
                          }
                          title="Remove dependency"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {!disabled && availableDeps.length > 0 && (
            <div className="step-field">
              <label className="step-field-label">Add Dependency</label>
              <select
                className="dependency-select"
                value=""
                onChange={(e) => {
                  if (e.target.value && !step.dependencies.includes(e.target.value)) {
                    handleUpdate('dependencies', [...step.dependencies, e.target.value]);
                  }
                }}
              >
                <option value="">Select a step...</option>
                {availableDeps.map((s) => (
                  <option key={s.step_id} value={s.step_id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="step-field">
            <label className="step-field-label">Acceptance Criteria</label>
            <ul className="acceptance-criteria-list">
              {(step.acceptance_criteria || []).map((criterion) => (
                <li key={criterion.id} className="criterion-item">
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
                    className="criterion-description"
                  />
                  {criterion.type && (
                    <span className="criterion-type">{criterion.type}</span>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      className="criterion-remove"
                      onClick={() => {
                        const updated = (step.acceptance_criteria || []).filter(
                          (c) => c.id !== criterion.id
                        );
                        handleUpdate('acceptance_criteria', updated);
                      }}
                      title="Remove criterion"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!disabled && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const newCriterion = {
                    id: crypto.randomUUID(),
                    description: '',
                  };
                  const updated = [...(step.acceptance_criteria || []), newCriterion];
                  handleUpdate('acceptance_criteria', updated);
                }}
              >
                + Add Criterion
              </button>
            )}
          </div>

          <div className="step-field">
            <label className="step-field-label">Gate</label>
            <div className="gate-toggle">
              <label className="gate-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!step.gate}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleUpdate('gate', { type: 'human_approval' });
                    } else {
                      handleUpdate('gate', undefined);
                    }
                  }}
                />
                Require human approval
              </label>
              {step.gate && (
                <div className="gate-details">
                  <label className="step-field-label">Approver Role</label>
                  <EditableText
                    value={step.gate.approver_role || ''}
                    onSave={(value) => {
                      handleUpdate('gate', {
                        ...step.gate,
                        approver_role: value || undefined,
                      });
                    }}
                    placeholder="e.g., tech-lead (optional)"
                    disabled={!isEditable}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

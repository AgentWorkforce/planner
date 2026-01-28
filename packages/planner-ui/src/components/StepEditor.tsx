import { useState, useCallback } from 'react';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
import type { Step } from '@/types';

interface StepEditorProps {
  step: Step;
  allSteps: Step[];
  onUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  onDelete: (stepId: string) => Promise<void>;
  disabled?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function StepEditor({
  step,
  allSteps,
  onUpdate,
  onDelete,
  disabled = false,
  isExpanded = false,
  onToggleExpand,
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
              <EditableText
                value={step.owner_role || ''}
                onSave={(value) => handleUpdate('owner_role', value)}
                placeholder="e.g., backend:Coder"
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
                  if (e.target.value) {
                    handleUpdate('dependencies', [...step.dependencies, e.target.value]);
                    e.target.value = '';
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

          {step.acceptance_criteria && step.acceptance_criteria.length > 0 && (
            <div className="step-field">
              <label className="step-field-label">Acceptance Criteria</label>
              <ul className="acceptance-criteria-list">
                {step.acceptance_criteria.map((criterion) => (
                  <li key={criterion.id} className="criterion-item">
                    <span className="criterion-description">{criterion.description}</span>
                    {criterion.type && (
                      <span className="criterion-type">{criterion.type}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step.gate && (
            <div className="step-field">
              <label className="step-field-label">Gate</label>
              <div className="gate-info">
                <span className="gate-type">{step.gate.type}</span>
                {step.gate.approver_role && (
                  <span className="gate-approver">Approver: {step.gate.approver_role}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

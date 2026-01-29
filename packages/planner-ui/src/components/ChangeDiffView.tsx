import type { ChangeRequest, Step, StepModification } from '@/types';

interface ChangeDiffViewProps {
  /** Change request with suggested changes */
  changeRequest: ChangeRequest;
  /** Current steps for comparison */
  currentSteps: Step[];
  /** Callback to close the diff view */
  onClose: () => void;
}

/**
 * Side-by-side or inline diff view showing original vs suggested changes.
 */
export function ChangeDiffView({
  changeRequest,
  currentSteps,
  onClose,
}: ChangeDiffViewProps) {
  const { suggested_changes } = changeRequest;
  const { add_steps, modify_steps, remove_steps } = suggested_changes;

  return (
    <div className="change-diff-view">
      <div className="change-diff-header">
        <h3>Change Request Diff</h3>
        <button
          className="btn btn-sm btn-secondary"
          onClick={onClose}
          aria-label="Close diff view"
        >
          Close
        </button>
      </div>

      <div className="change-diff-meta">
        <span className="diff-meta-item">
          <strong>Run:</strong> {changeRequest.run_id}
        </span>
        <span className="diff-meta-item">
          <strong>Reason:</strong> {changeRequest.reason}
        </span>
      </div>

      <div className="change-diff-content">
        {/* Steps to Add */}
        {add_steps && add_steps.length > 0 && (
          <div className="diff-section diff-section-add">
            <h4 className="diff-section-title">
              <span className="diff-icon diff-icon-add">+</span>
              Steps to Add
            </h4>
            {add_steps.map((step) => (
              <StepAddDiff key={step.step_id} step={step} />
            ))}
          </div>
        )}

        {/* Steps to Modify */}
        {modify_steps && modify_steps.length > 0 && (
          <div className="diff-section diff-section-modify">
            <h4 className="diff-section-title">
              <span className="diff-icon diff-icon-modify">~</span>
              Steps to Modify
            </h4>
            {modify_steps.map((modification) => {
              const originalStep = currentSteps.find(
                (s) => s.step_id === modification.step_id
              );
              return (
                <StepModifyDiff
                  key={modification.step_id}
                  original={originalStep}
                  modification={modification}
                />
              );
            })}
          </div>
        )}

        {/* Steps to Remove */}
        {remove_steps && remove_steps.length > 0 && (
          <div className="diff-section diff-section-remove">
            <h4 className="diff-section-title">
              <span className="diff-icon diff-icon-remove">-</span>
              Steps to Remove
            </h4>
            {remove_steps.map((stepId) => {
              const step = currentSteps.find((s) => s.step_id === stepId);
              return (
                <StepRemoveDiff key={stepId} step={step} stepId={stepId} />
              );
            })}
          </div>
        )}

        {/* No changes */}
        {!add_steps?.length && !modify_steps?.length && !remove_steps?.length && (
          <div className="diff-empty">
            No changes suggested.
          </div>
        )}
      </div>
    </div>
  );
}

interface StepAddDiffProps {
  step: Step;
}

function StepAddDiff({ step }: StepAddDiffProps) {
  return (
    <div className="diff-step diff-step-add">
      <div className="diff-step-header">
        <span className="diff-marker diff-marker-add">+</span>
        <strong>{step.title}</strong>
        {step.scope && <span className="diff-step-scope">[{step.scope}]</span>}
      </div>
      <div className="diff-step-content">
        {step.description && (
          <p className="diff-step-description">{step.description}</p>
        )}
        {step.dependencies && step.dependencies.length > 0 && (
          <div className="diff-step-dependencies">
            <span className="diff-label">Dependencies:</span>{' '}
            {step.dependencies.join(', ')}
          </div>
        )}
        {step.owner_role && (
          <div className="diff-step-role">
            <span className="diff-label">Owner:</span> {step.owner_role}
          </div>
        )}
      </div>
    </div>
  );
}

interface StepModifyDiffProps {
  original?: Step;
  modification: StepModification;
}

function StepModifyDiff({ original, modification }: StepModifyDiffProps) {
  if (!original) {
    return (
      <div className="diff-step diff-step-modify diff-step-error">
        <div className="diff-step-header">
          <span className="diff-marker diff-marker-modify">~</span>
          <strong>Unknown step</strong>
        </div>
        <p className="diff-step-error-message">
          Original step not found (ID: {modification.step_id})
        </p>
      </div>
    );
  }

  return (
    <div className="diff-step diff-step-modify">
      <div className="diff-step-header">
        <span className="diff-marker diff-marker-modify">~</span>
        <strong>{original.title}</strong>
        {original.scope && <span className="diff-step-scope">[{original.scope}]</span>}
      </div>
      <div className="diff-step-content">
        {/* Title change */}
        {modification.title && modification.title !== original.title && (
          <DiffField
            label="Title"
            oldValue={original.title}
            newValue={modification.title}
          />
        )}

        {/* Description change */}
        {modification.description !== undefined &&
          modification.description !== original.description && (
            <DiffField
              label="Description"
              oldValue={original.description || '(none)'}
              newValue={modification.description || '(none)'}
            />
          )}

        {/* Scope change */}
        {modification.scope !== undefined && modification.scope !== original.scope && (
          <DiffField
            label="Scope"
            oldValue={original.scope || '(none)'}
            newValue={modification.scope || '(none)'}
          />
        )}

        {/* Owner role change */}
        {modification.owner_role !== undefined &&
          modification.owner_role !== original.owner_role && (
            <DiffField
              label="Owner"
              oldValue={original.owner_role || '(none)'}
              newValue={modification.owner_role || '(none)'}
            />
          )}

        {/* Dependencies change */}
        {modification.dependencies && (
          <DiffField
            label="Dependencies"
            oldValue={original.dependencies.join(', ') || '(none)'}
            newValue={modification.dependencies.join(', ') || '(none)'}
          />
        )}
      </div>
    </div>
  );
}

interface StepRemoveDiffProps {
  step?: Step;
  stepId: string;
}

function StepRemoveDiff({ step, stepId }: StepRemoveDiffProps) {
  if (!step) {
    return (
      <div className="diff-step diff-step-remove diff-step-error">
        <div className="diff-step-header">
          <span className="diff-marker diff-marker-remove">-</span>
          <strong>Unknown step</strong>
        </div>
        <p className="diff-step-error-message">
          Step not found (ID: {stepId})
        </p>
      </div>
    );
  }

  return (
    <div className="diff-step diff-step-remove">
      <div className="diff-step-header">
        <span className="diff-marker diff-marker-remove">-</span>
        <strong className="diff-strikethrough">{step.title}</strong>
        {step.scope && (
          <span className="diff-step-scope diff-strikethrough">[{step.scope}]</span>
        )}
      </div>
      <div className="diff-step-content diff-step-content-removed">
        {step.description && (
          <p className="diff-step-description">{step.description}</p>
        )}
      </div>
    </div>
  );
}

interface DiffFieldProps {
  label: string;
  oldValue: string;
  newValue: string;
}

function DiffField({ label, oldValue, newValue }: DiffFieldProps) {
  return (
    <div className="diff-field">
      <span className="diff-field-label">{label}:</span>
      <div className="diff-field-values">
        <div className="diff-field-old">
          <span className="diff-marker-inline">-</span>
          <span className="diff-value-old">{oldValue}</span>
        </div>
        <div className="diff-field-new">
          <span className="diff-marker-inline">+</span>
          <span className="diff-value-new">{newValue}</span>
        </div>
      </div>
    </div>
  );
}

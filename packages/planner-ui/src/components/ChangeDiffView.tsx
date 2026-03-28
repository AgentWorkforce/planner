import type { ChangeRequest, Step, StepModification } from '@/types';
import { PlusIcon } from './icons';

interface ChangeDiffViewProps {
  /** Change request with suggested changes */
  changeRequest: ChangeRequest;
  /** Current steps for comparison */
  currentSteps: Step[];
  /** Callback to close the diff view */
  onClose: () => void;
}

// Minus icon for remove
function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

// Tilde icon for modify
function TildeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12c0-3 2-6 6-6s6 6 12 6 6-3 6-6" />
    </svg>
  );
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
    <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <h3 className="text-lg font-semibold text-text-primary">Change Request Diff</h3>
        <button
          className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
          onClick={onClose}
          aria-label="Close diff view"
        >
          Close
        </button>
      </div>

      <div className="px-6 py-3 bg-bg-secondary border-b border-border-subtle flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="text-text-muted">
          <strong className="text-text-secondary">Run:</strong> {changeRequest.run_id}
        </span>
        <span className="text-text-muted">
          <strong className="text-text-secondary">Reason:</strong> {changeRequest.reason}
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Steps to Add */}
        {add_steps && add_steps.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-success font-medium">
              <PlusIcon size="sm" />
              Steps to Add
            </h4>
            <div className="space-y-2">
              {add_steps.map((step) => (
                <StepAddDiff key={step.step_id} step={step} />
              ))}
            </div>
          </div>
        )}

        {/* Steps to Modify */}
        {modify_steps && modify_steps.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-warning font-medium">
              <TildeIcon />
              Steps to Modify
            </h4>
            <div className="space-y-2">
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
          </div>
        )}

        {/* Steps to Remove */}
        {remove_steps && remove_steps.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-error font-medium">
              <MinusIcon />
              Steps to Remove
            </h4>
            <div className="space-y-2">
              {remove_steps.map((stepId) => {
                const step = currentSteps.find((s) => s.step_id === stepId);
                return (
                  <StepRemoveDiff key={stepId} step={step} stepId={stepId} />
                );
              })}
            </div>
          </div>
        )}

        {/* No changes */}
        {!add_steps?.length && !modify_steps?.length && !remove_steps?.length && (
          <div className="text-center text-text-muted py-8">
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
    <div className="bg-success/5 border border-success/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-success font-mono text-sm">+</span>
        <strong className="text-text-primary">{step.title}</strong>
        {step.scope && (
          <span className="text-xs px-2 py-0.5 bg-bg-tertiary text-text-muted rounded">
            [{step.scope}]
          </span>
        )}
      </div>
      <div className="pl-5 space-y-1 text-sm text-text-secondary">
        {step.description && <p>{step.description}</p>}
        {step.dependencies && step.dependencies.length > 0 && (
          <div>
            <span className="text-text-muted">Dependencies:</span>{' '}
            {step.dependencies.join(', ')}
          </div>
        )}
        {step.owner_role && (
          <div>
            <span className="text-text-muted">Owner:</span> {step.owner_role}
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
      <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-warning font-mono text-sm">~</span>
          <strong className="text-text-primary">Unknown step</strong>
        </div>
        <p className="pl-5 text-sm text-error">
          Original step not found (ID: {modification.step_id})
        </p>
      </div>
    );
  }

  return (
    <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-warning font-mono text-sm">~</span>
        <strong className="text-text-primary">{original.title}</strong>
        {original.scope && (
          <span className="text-xs px-2 py-0.5 bg-bg-tertiary text-text-muted rounded">
            [{original.scope}]
          </span>
        )}
      </div>
      <div className="pl-5 space-y-2">
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
      <div className="bg-error/5 border border-error/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-error font-mono text-sm">-</span>
          <strong className="text-text-primary">Unknown step</strong>
        </div>
        <p className="pl-5 text-sm text-error">
          Step not found (ID: {stepId})
        </p>
      </div>
    );
  }

  return (
    <div className="bg-error/5 border border-error/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-error font-mono text-sm">-</span>
        <strong className="text-text-primary line-through opacity-70">{step.title}</strong>
        {step.scope && (
          <span className="text-xs px-2 py-0.5 bg-bg-tertiary text-text-muted rounded line-through opacity-70">
            [{step.scope}]
          </span>
        )}
      </div>
      {step.description && (
        <p className="pl-5 text-sm text-text-muted line-through opacity-70">
          {step.description}
        </p>
      )}
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
    <div className="text-sm">
      <span className="text-text-muted">{label}:</span>
      <div className="mt-1 space-y-1 font-mono text-xs">
        <div className="flex items-start gap-2 bg-error/10 rounded px-2 py-1">
          <span className="text-error">-</span>
          <span className="text-error/80">{oldValue}</span>
        </div>
        <div className="flex items-start gap-2 bg-success/10 rounded px-2 py-1">
          <span className="text-success">+</span>
          <span className="text-success/80">{newValue}</span>
        </div>
      </div>
    </div>
  );
}

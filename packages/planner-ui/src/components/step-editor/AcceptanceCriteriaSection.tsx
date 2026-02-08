import { useCallback } from 'react';
import { EditableText } from '../EditableText';
import { CloseIcon, PlusIcon } from '../icons';
import type { Step } from '@/types';

interface AcceptanceCriteriaSectionProps {
  step: Step;
  onUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  disabled?: boolean;
}

export function AcceptanceCriteriaSection({
  step,
  onUpdate,
  disabled = false,
}: AcceptanceCriteriaSectionProps) {
  const handleUpdateCriterion = useCallback(
    async (criterionId: string, value: string) => {
      const updated = (step.acceptance_criteria || []).map((c) =>
        c.id === criterionId ? { ...c, description: value } : c
      );
      await onUpdate(step.step_id, { acceptance_criteria: updated });
    },
    [step.step_id, step.acceptance_criteria, onUpdate]
  );

  const handleRemoveCriterion = useCallback(
    async (criterionId: string) => {
      const updated = (step.acceptance_criteria || []).filter(
        (c) => c.id !== criterionId
      );
      await onUpdate(step.step_id, { acceptance_criteria: updated });
    },
    [step.step_id, step.acceptance_criteria, onUpdate]
  );

  const handleAddCriterion = useCallback(async () => {
    const newCriterion = {
      id: crypto.randomUUID(),
      description: '',
    };
    const updated = [...(step.acceptance_criteria || []), newCriterion];
    await onUpdate(step.step_id, { acceptance_criteria: updated });
  }, [step.step_id, step.acceptance_criteria, onUpdate]);

  return (
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
                onSave={(value) => handleUpdateCriterion(criterion.id, value)}
                placeholder="Enter criterion..."
                disabled={disabled}
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
                onClick={() => handleRemoveCriterion(criterion.id)}
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
          onClick={handleAddCriterion}
        >
          <PlusIcon size="sm" />
          Add Criterion
        </button>
      )}
    </div>
  );
}

import { useCallback } from 'react';
import { CloseIcon } from '../icons';
import type { Step } from '@/types';

interface DependenciesSectionProps {
  step: Step;
  allSteps: Step[];
  onUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  disabled?: boolean;
}

export function DependenciesSection({
  step,
  allSteps,
  onUpdate,
  disabled = false,
}: DependenciesSectionProps) {
  const availableDeps = allSteps.filter(
    (s) => s.step_id !== step.step_id && !s.dependencies.includes(step.step_id)
  );

  const handleAddDependency = useCallback(
    async (depId: string) => {
      if (depId && !step.dependencies.includes(depId)) {
        await onUpdate(step.step_id, { dependencies: [...step.dependencies, depId] });
      }
    },
    [step.step_id, step.dependencies, onUpdate]
  );

  const handleRemoveDependency = useCallback(
    async (depId: string) => {
      await onUpdate(step.step_id, {
        dependencies: step.dependencies.filter((d) => d !== depId),
      });
    },
    [step.step_id, step.dependencies, onUpdate]
  );

  if (step.dependencies.length === 0 && (disabled || availableDeps.length === 0)) {
    return null;
  }

  return (
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
                    onClick={() => handleRemoveDependency(depId)}
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
          onChange={(e) => handleAddDependency(e.target.value)}
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
  );
}

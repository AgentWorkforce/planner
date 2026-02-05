import { useCallback } from 'react';
import { EditableText } from '../EditableText';
import type { Step } from '@/types';

interface ApprovalGateSectionProps {
  step: Step;
  onUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  disabled?: boolean;
}

export function ApprovalGateSection({
  step,
  onUpdate,
  disabled = false,
}: ApprovalGateSectionProps) {
  const handleToggleGate = useCallback(
    async (checked: boolean) => {
      if (checked) {
        await onUpdate(step.step_id, { gate: { type: 'human_approval' } });
      } else {
        await onUpdate(step.step_id, { gate: undefined });
      }
    },
    [step.step_id, onUpdate]
  );

  const handleUpdateApproverRole = useCallback(
    async (value: string) => {
      if (!step.gate) return;
      await onUpdate(step.step_id, {
        gate: {
          ...step.gate,
          approver_role: value || undefined,
        },
      });
    },
    [step.step_id, step.gate, onUpdate]
  );

  return (
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
          onChange={(e) => handleToggleGate(e.target.checked)}
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
            onSave={handleUpdateApproverRole}
            placeholder="e.g., tech-lead"
            disabled={disabled}
            className="text-sm max-w-xs"
          />
        </div>
      )}
    </div>
  );
}

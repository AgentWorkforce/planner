import { useState, useCallback } from 'react';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
import type { PlanVersion, PlanStatus } from '@/types';

interface PlanHeaderProps {
  version: PlanVersion;
  onUpdateGoal: (goal: string) => Promise<void>;
  onUpdateContext: (context: string) => Promise<void>;
  disabled?: boolean;
}

export function PlanHeader({
  version,
  onUpdateGoal,
  onUpdateContext,
  disabled = false,
}: PlanHeaderProps) {
  const [saving, setSaving] = useState(false);

  const handleUpdateGoal = useCallback(
    async (goal: string) => {
      setSaving(true);
      try {
        await onUpdateGoal(goal);
      } finally {
        setSaving(false);
      }
    },
    [onUpdateGoal]
  );

  const handleUpdateContext = useCallback(
    async (context: string) => {
      setSaving(true);
      try {
        await onUpdateContext(context);
      } finally {
        setSaving(false);
      }
    },
    [onUpdateContext]
  );

  const getStatusBadgeClass = (status: PlanStatus) => {
    switch (status) {
      case 'draft':
        return 'badge badge-draft';
      case 'approved':
        return 'badge badge-approved';
      case 'published':
        return 'badge badge-published';
      default:
        return 'badge';
    }
  };

  const isEditable = version.status === 'draft' && !disabled && !saving;

  return (
    <div className="plan-header-editable">
      <div className="plan-header-row">
        <EditableText
          value={version.summary.goal}
          onSave={handleUpdateGoal}
          placeholder="Enter plan goal..."
          disabled={!isEditable}
          as="h1"
          className="plan-goal-editable"
        />
        <div className="plan-badges">
          <span className={getStatusBadgeClass(version.status)}>{version.status}</span>
          <span className="plan-version-badge">v{version.version}</span>
          {version.submitted_at && <span className="badge badge-submitted">Submitted</span>}
          {saving && <span className="badge badge-saving">Saving...</span>}
        </div>
      </div>

      <div className="plan-context-section">
        <label className="section-label">Context</label>
        <EditableTextarea
          value={version.summary.context || ''}
          onSave={handleUpdateContext}
          placeholder="Add context, constraints, or additional information..."
          disabled={!isEditable}
          rows={4}
          className="plan-context-editable"
        />
      </div>
    </div>
  );
}

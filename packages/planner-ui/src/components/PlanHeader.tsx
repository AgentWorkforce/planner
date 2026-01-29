import { useState, useCallback } from 'react';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
import { MessageIcon } from './icons';
import type { PlanVersion, PlanStatus } from '@/types';

interface PlanHeaderProps {
  version: PlanVersion;
  onUpdateGoal: (goal: string) => Promise<void>;
  onUpdateContext: (context: string) => Promise<void>;
  disabled?: boolean;
  unresolvedCommentCount?: number;
  onFilterByComments?: () => void;
}

export function PlanHeader({
  version,
  onUpdateGoal,
  onUpdateContext,
  disabled = false,
  unresolvedCommentCount = 0,
  onFilterByComments,
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

  const getStatusBadgeClasses = (status: PlanStatus) => {
    const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide';
    switch (status) {
      case 'draft':
        return `${base} bg-warning/10 text-warning`;
      case 'approved':
        return `${base} bg-success/10 text-success`;
      case 'published':
        return `${base} bg-accent-cyan/10 text-accent-cyan`;
      default:
        return `${base} bg-bg-tertiary text-text-secondary`;
    }
  };

  const isEditable = version.status === 'draft' && !disabled && !saving;

  return (
    <div className="space-y-4 p-4 bg-bg-secondary rounded-xl border border-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <EditableText
          value={version.summary.goal}
          onSave={handleUpdateGoal}
          placeholder="Enter plan goal..."
          disabled={!isEditable}
          as="h1"
          className="flex-1 min-w-0 font-display text-2xl text-text-primary"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className={getStatusBadgeClasses(version.status)}>{version.status}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-tertiary text-text-secondary">
            v{version.version}
          </span>
          {version.submitted_at && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-accent-purple/10 text-accent-purple">
              Submitted
            </span>
          )}
          {saving && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-cyan/10 text-accent-cyan animate-pulse">
              Saving...
            </span>
          )}
          {unresolvedCommentCount > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
              onClick={onFilterByComments}
              title="Click to filter steps with comments"
            >
              <MessageIcon size="sm" />
              {unresolvedCommentCount} unresolved
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">Context</label>
        <EditableTextarea
          value={version.summary.context || ''}
          onSave={handleUpdateContext}
          placeholder="Add context, constraints, or additional information..."
          disabled={!isEditable}
          rows={4}
          className="w-full"
        />
      </div>
    </div>
  );
}

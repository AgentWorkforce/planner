import { useState } from 'react';
import type { Improvement, FlaggedConcern, ActivityEntry } from '@/types';
import { CloseIcon, AlertIcon } from './icons';

interface ImprovementBadgeProps {
  count: number;
  improvements: Improvement[];
  concerns: FlaggedConcern[];
  activityLog: ActivityEntry[];
  isAnalyzing: boolean;
  onUndo: (improvementId: string) => void;
  onDismissConcern: (concernId: string) => void;
  onNavigateToStep?: (stepId: string) => void;
}

export function ImprovementBadge({
  count,
  improvements,
  concerns,
  activityLog,
  isAnalyzing,
  onUndo,
  onDismissConcern,
  onNavigateToStep,
}: ImprovementBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'improvements' | 'concerns' | 'activity'>('improvements');

  const appliedImprovements = improvements.filter((i) => i.status === 'applied');
  const activeConcerns = concerns.filter((c) => !c.dismissed);
  const hasConcerns = activeConcerns.length > 0;

  if (count === 0 && !hasConcerns && !isAnalyzing) {
    return null;
  }

  return (
    <div className="relative">
      <button
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
          isAnalyzing
            ? 'bg-accent-cyan/10 text-accent-cyan'
            : hasConcerns
            ? 'bg-warning/10 text-warning'
            : 'bg-accent-purple/10 text-accent-purple'
        } hover:ring-2 hover:ring-current/30`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`AI Improvements: ${count} applied${hasConcerns ? `, ${activeConcerns.length} concerns` : ''}`}
      >
        {isAnalyzing ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : hasConcerns ? (
          <AlertIcon size="sm" />
        ) : (
          <span className="font-bold">AI</span>
        )}
        {count > 0 && <span>{count}</span>}
        {hasConcerns && <span className="text-warning">{activeConcerns.length}</span>}
      </button>

      {isExpanded && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-bg-card border border-border-subtle rounded-xl shadow-lg z-50 animate-fade-in"
          role="dialog"
          aria-label="AI Improvements"
        >
          <div className="flex items-center justify-between p-3 border-b border-border-subtle">
            <h4 className="font-display text-sm text-text-primary">AI Assistant</h4>
            <button
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setIsExpanded(false)}
              aria-label="Close"
            >
              <CloseIcon size="sm" />
            </button>
          </div>

          <div className="flex border-b border-border-subtle">
            <button
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'improvements'
                  ? 'text-accent-cyan border-b-2 border-accent-cyan -mb-px'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('improvements')}
            >
              Improvements ({appliedImprovements.length})
            </button>
            <button
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'concerns'
                  ? 'text-accent-cyan border-b-2 border-accent-cyan -mb-px'
                  : hasConcerns
                  ? 'text-warning'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('concerns')}
            >
              Concerns ({activeConcerns.length})
            </button>
            <button
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'activity'
                  ? 'text-accent-cyan border-b-2 border-accent-cyan -mb-px'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-3">
            {activeTab === 'improvements' && (
              <ImprovementsList
                improvements={appliedImprovements}
                onUndo={onUndo}
                onNavigateToStep={onNavigateToStep}
              />
            )}
            {activeTab === 'concerns' && (
              <ConcernsList
                concerns={activeConcerns}
                onDismiss={onDismissConcern}
                onNavigateToStep={onNavigateToStep}
              />
            )}
            {activeTab === 'activity' && <ActivityLog entries={activityLog} />}
          </div>
        </div>
      )}
    </div>
  );
}

interface ImprovementsListProps {
  improvements: Improvement[];
  onUndo: (id: string) => void;
  onNavigateToStep?: (stepId: string) => void;
}

function ImprovementsList({ improvements, onUndo, onNavigateToStep }: ImprovementsListProps) {
  if (improvements.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-secondary">No improvements yet.</p>
        <p className="text-xs text-text-muted mt-1">
          AI will suggest improvements as you work on your plan.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {improvements.map((improvement) => (
        <li key={improvement.id} className="p-2 bg-bg-elevated rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent-purple/10 text-accent-purple capitalize">
              {improvement.type}
            </span>
            <span className="text-xs text-text-muted">
              {new Date(improvement.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-xs text-text-secondary mb-2">{improvement.description}</p>
          <div className="flex items-center gap-2">
            {onNavigateToStep && (
              <button
                className="text-xs text-accent-cyan hover:underline"
                onClick={() => onNavigateToStep(improvement.step_id)}
              >
                View step
              </button>
            )}
            <button
              className="text-xs text-text-muted hover:text-text-primary"
              onClick={() => onUndo(improvement.id)}
            >
              Undo
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ConcernsListProps {
  concerns: FlaggedConcern[];
  onDismiss: (id: string) => void;
  onNavigateToStep?: (stepId: string) => void;
}

function ConcernsList({ concerns, onDismiss, onNavigateToStep }: ConcernsListProps) {
  if (concerns.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-secondary">No concerns flagged.</p>
      </div>
    );
  }

  const severityClasses: Record<string, string> = {
    error: 'border-l-error',
    warning: 'border-l-warning',
    info: 'border-l-accent-cyan',
  };

  return (
    <ul className="space-y-2">
      {concerns.map((concern) => (
        <li
          key={concern.id}
          className={`p-2 bg-bg-elevated rounded-lg border-l-2 ${severityClasses[concern.severity] || ''}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                concern.severity === 'error'
                  ? 'bg-error/10 text-error'
                  : concern.severity === 'warning'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-accent-cyan/10 text-accent-cyan'
              }`}
            >
              {concern.severity === 'error' ? '!' : concern.severity === 'warning' ? '?' : 'i'}
            </span>
            <span className="text-sm font-medium text-text-primary">{concern.title}</span>
          </div>
          <p className="text-xs text-text-secondary mb-2">{concern.description}</p>
          {concern.suggestions && concern.suggestions.length > 0 && (
            <ul className="list-disc list-inside text-xs text-text-muted mb-2 space-y-0.5">
              {concern.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            {onNavigateToStep && (
              <button
                className="text-xs text-accent-cyan hover:underline"
                onClick={() => onNavigateToStep(concern.step_id)}
              >
                View step
              </button>
            )}
            <button
              className="text-xs text-text-muted hover:text-text-primary"
              onClick={() => onDismiss(concern.id)}
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ActivityLogProps {
  entries: ActivityEntry[];
}

function ActivityLog({ entries }: ActivityLogProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-secondary">No activity yet.</p>
      </div>
    );
  }

  const getActivityIcon = (type: ActivityEntry['type']) => {
    switch (type) {
      case 'ai_improvement':
        return { icon: '+', class: 'text-success' };
      case 'ai_concern':
        return { icon: '!', class: 'text-warning' };
      case 'undo':
        return { icon: '↩', class: 'text-text-muted' };
      default:
        return { icon: '•', class: 'text-text-muted' };
    }
  };

  return (
    <ul className="space-y-1">
      {entries.slice(0, 20).map((entry) => {
        const { icon, class: iconClass } = getActivityIcon(entry.type);
        return (
          <li key={entry.id} className="flex items-center gap-2 text-xs py-1">
            <span className={`w-4 text-center font-mono ${iconClass}`}>{icon}</span>
            <span className="flex-1 text-text-secondary truncate">{entry.description}</span>
            <span className="text-text-muted">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

import { useState } from 'react';
import type { Improvement, FlaggedConcern, ActivityEntry } from '@/types';

interface ImprovementBadgeProps {
  /** Count of applied improvements */
  count: number;
  /** List of improvements */
  improvements: Improvement[];
  /** Flagged concerns */
  concerns: FlaggedConcern[];
  /** Activity log */
  activityLog: ActivityEntry[];
  /** Whether analysis is in progress */
  isAnalyzing: boolean;
  /** Callback to undo an improvement */
  onUndo: (improvementId: string) => void;
  /** Callback to dismiss a concern */
  onDismissConcern: (concernId: string) => void;
  /** Callback to navigate to a step */
  onNavigateToStep?: (stepId: string) => void;
}

/**
 * Badge showing count of AI improvements with expandable details panel.
 */
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

  // Don't show if no improvements and no concerns
  if (count === 0 && !hasConcerns && !isAnalyzing) {
    return null;
  }

  return (
    <div className="improvement-badge-container">
      <button
        className={`improvement-badge ${hasConcerns ? 'has-concerns' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`AI Improvements: ${count} applied${hasConcerns ? `, ${activeConcerns.length} concerns` : ''}`}
      >
        {isAnalyzing ? (
          <span className="improvement-badge-icon analyzing">
            <span className="spinner-small" />
          </span>
        ) : hasConcerns ? (
          <span className="improvement-badge-icon warning">!</span>
        ) : (
          <span className="improvement-badge-icon">AI</span>
        )}
        {count > 0 && <span className="improvement-badge-count">{count}</span>}
        {hasConcerns && <span className="improvement-badge-concerns">{activeConcerns.length}</span>}
      </button>

      {isExpanded && (
        <div className="improvement-panel" role="dialog" aria-label="AI Improvements">
          <div className="improvement-panel-header">
            <h4>AI Assistant</h4>
            <button
              className="improvement-panel-close"
              onClick={() => setIsExpanded(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="improvement-panel-tabs">
            <button
              className={`improvement-tab ${activeTab === 'improvements' ? 'active' : ''}`}
              onClick={() => setActiveTab('improvements')}
            >
              Improvements ({appliedImprovements.length})
            </button>
            <button
              className={`improvement-tab ${activeTab === 'concerns' ? 'active' : ''} ${hasConcerns ? 'has-items' : ''}`}
              onClick={() => setActiveTab('concerns')}
            >
              Concerns ({activeConcerns.length})
            </button>
            <button
              className={`improvement-tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          <div className="improvement-panel-content">
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
      <div className="improvement-empty">
        <p>No improvements yet.</p>
        <p className="improvement-empty-hint">
          AI will suggest improvements as you work on your plan.
        </p>
      </div>
    );
  }

  return (
    <ul className="improvement-list">
      {improvements.map((improvement) => (
        <li key={improvement.id} className="improvement-item">
          <div className="improvement-item-header">
            <span className={`improvement-type improvement-type--${improvement.type}`}>
              {improvement.type}
            </span>
            <span className="improvement-time">
              {new Date(improvement.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="improvement-description">{improvement.description}</p>
          <div className="improvement-actions">
            {onNavigateToStep && (
              <button
                className="btn btn-sm btn-link"
                onClick={() => onNavigateToStep(improvement.step_id)}
              >
                View step
              </button>
            )}
            <button className="btn btn-sm btn-secondary" onClick={() => onUndo(improvement.id)}>
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
      <div className="improvement-empty">
        <p>No concerns flagged.</p>
      </div>
    );
  }

  return (
    <ul className="concern-list">
      {concerns.map((concern) => (
        <li key={concern.id} className={`concern-item concern-item--${concern.severity}`}>
          <div className="concern-header">
            <span className={`concern-severity concern-severity--${concern.severity}`}>
              {concern.severity === 'error' ? '!' : concern.severity === 'warning' ? '?' : 'i'}
            </span>
            <span className="concern-title">{concern.title}</span>
          </div>
          <p className="concern-description">{concern.description}</p>
          {concern.suggestions && concern.suggestions.length > 0 && (
            <ul className="concern-suggestions">
              {concern.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          )}
          <div className="concern-actions">
            {onNavigateToStep && (
              <button
                className="btn btn-sm btn-link"
                onClick={() => onNavigateToStep(concern.step_id)}
              >
                View step
              </button>
            )}
            <button className="btn btn-sm btn-secondary" onClick={() => onDismiss(concern.id)}>
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
      <div className="improvement-empty">
        <p>No activity yet.</p>
      </div>
    );
  }

  const getActivityIcon = (type: ActivityEntry['type']) => {
    switch (type) {
      case 'ai_improvement':
        return '+';
      case 'ai_concern':
        return '!';
      case 'undo':
        return '↩';
      default:
        return '•';
    }
  };

  return (
    <ul className="activity-log">
      {entries.slice(0, 20).map((entry) => (
        <li key={entry.id} className={`activity-entry activity-entry--${entry.type}`}>
          <span className="activity-icon">{getActivityIcon(entry.type)}</span>
          <span className="activity-description">{entry.description}</span>
          <span className="activity-time">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

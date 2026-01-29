import { useState } from 'react';
import type { FlaggedConcern } from '@/types';

interface FlaggedConcernIndicatorProps {
  /** Concern data */
  concern: FlaggedConcern;
  /** Callback to dismiss the concern */
  onDismiss: (concernId: string) => void;
}

/**
 * Inline warning indicator for flagged concerns on steps.
 * Shows as an icon with tooltip, expandable to show details.
 */
export function FlaggedConcernIndicator({ concern, onDismiss }: FlaggedConcernIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSeverityIcon = () => {
    switch (concern.severity) {
      case 'error':
        return '⚠';
      case 'warning':
        return '⚡';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`flagged-concern flagged-concern--${concern.severity}`}>
      <button
        className="flagged-concern-trigger"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${concern.severity}: ${concern.title}`}
        title={concern.title}
      >
        <span className="flagged-concern-icon" aria-hidden="true">
          {getSeverityIcon()}
        </span>
      </button>

      {isExpanded && (
        <div className="flagged-concern-popover" role="dialog" aria-label={concern.title}>
          <div className="flagged-concern-header">
            <span className={`flagged-concern-severity flagged-concern-severity--${concern.severity}`}>
              {concern.severity}
            </span>
            <span className="flagged-concern-title">{concern.title}</span>
          </div>
          <p className="flagged-concern-description">{concern.description}</p>
          {concern.suggestions && concern.suggestions.length > 0 && (
            <div className="flagged-concern-suggestions">
              <strong>Suggestions:</strong>
              <ul>
                {concern.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flagged-concern-actions">
            <button className="btn btn-sm btn-secondary" onClick={() => onDismiss(concern.id)}>
              Dismiss
            </button>
            <button className="btn btn-sm btn-link" onClick={() => setIsExpanded(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StepConcernsProps {
  /** Concerns for this step */
  concerns: FlaggedConcern[];
  /** Callback to dismiss */
  onDismiss: (concernId: string) => void;
}

/**
 * Container for all concerns on a step.
 */
export function StepConcerns({ concerns, onDismiss }: StepConcernsProps) {
  if (concerns.length === 0) {
    return null;
  }

  return (
    <div className="step-concerns">
      {concerns.map((concern) => (
        <FlaggedConcernIndicator key={concern.id} concern={concern} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

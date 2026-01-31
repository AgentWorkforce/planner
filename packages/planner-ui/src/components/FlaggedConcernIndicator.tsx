import { useState } from 'react';
import type { FlaggedConcern } from '@/types';
import { AlertIcon, CloseIcon } from './icons';

interface FlaggedConcernIndicatorProps {
  concern: FlaggedConcern;
  onDismiss: (concernId: string) => void;
}

/**
 * Inline warning indicator for flagged concerns on steps.
 * Shows as an icon with tooltip, expandable to show details.
 */
export function FlaggedConcernIndicator({ concern, onDismiss }: FlaggedConcernIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severityClasses: Record<string, string> = {
    error: 'text-error',
    warning: 'text-warning',
    info: 'text-accent-cyan',
  };

  const severityBgClasses: Record<string, string> = {
    error: 'bg-error/10 border-error/30',
    warning: 'bg-warning/10 border-warning/30',
    info: 'bg-accent-cyan/10 border-accent-cyan/30',
  };

  return (
    <div className="relative inline-flex">
      <button
        className={`p-1 rounded-full transition-colors hover:bg-bg-hover ${severityClasses[concern.severity] || 'text-text-muted'}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${concern.severity}: ${concern.title}`}
        title={concern.title}
      >
        <AlertIcon size="sm" />
      </button>

      {isExpanded && (
        <div
          className={`absolute z-50 right-0 top-full mt-1 w-72 p-3 rounded-lg border shadow-lg ${severityBgClasses[concern.severity] || 'bg-bg-card border-border-subtle'}`}
          role="dialog"
          aria-label={concern.title}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold uppercase ${severityClasses[concern.severity]}`}>
                {concern.severity}
              </span>
              <span className="text-sm font-medium text-text-primary">{concern.title}</span>
            </div>
            <button
              className="p-0.5 text-text-muted hover:text-text-primary"
              onClick={() => setIsExpanded(false)}
            >
              <CloseIcon size="sm" />
            </button>
          </div>
          <p className="text-sm text-text-secondary mb-3">{concern.description}</p>
          {concern.suggestions && concern.suggestions.length > 0 && (
            <div className="mb-3">
              <strong className="text-xs text-text-muted uppercase tracking-wide">Suggestions:</strong>
              <ul className="mt-1 list-disc list-inside text-sm text-text-secondary space-y-0.5">
                {concern.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              className="px-2 py-1 text-xs bg-bg-tertiary text-text-primary rounded hover:bg-bg-hover transition-colors"
              onClick={() => onDismiss(concern.id)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StepConcernsProps {
  concerns: FlaggedConcern[];
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
    <div className="flex items-center gap-1">
      {concerns.map((concern) => (
        <FlaggedConcernIndicator key={concern.id} concern={concern} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

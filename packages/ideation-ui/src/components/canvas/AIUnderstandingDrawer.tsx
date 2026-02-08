import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  OverallConfidenceBar,
  type ConfidenceLevel,
  type SpecialistPerspective,
} from './OverallConfidenceBar';

/**
 * AI Understanding data structure
 */
export interface AIUnderstanding {
  idea_summary?: string;
  specialist_perspectives?: Record<string, SpecialistPerspective>;
}

/**
 * Props for AIUnderstandingDrawer component
 */
export interface AIUnderstandingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  synthesized?: AIUnderstanding;
  className?: string;
}

/**
 * Specialist emoji mapping (can be customized or passed as prop)
 */
const SPECIALIST_EMOJIS: Record<string, string> = {
  architect: '🏗️',
  designer: '🎨',
  engineer: '⚙️',
  product: '📊',
  researcher: '🔬',
  security: '🔒',
  devops: '🚀',
  qa: '🧪',
};

/**
 * Get emoji for specialist name
 */
function getSpecialistEmoji(name: string): string {
  const normalized = name.toLowerCase();
  return SPECIALIST_EMOJIS[normalized] || '👤';
}

/**
 * SpecialistPerspectiveCard - Individual specialist card
 */
interface SpecialistPerspectiveCardProps {
  name: string;
  take: string;
  concerns: string[];
  confidence: ConfidenceLevel;
  className?: string;
}

function SpecialistPerspectiveCard({
  name,
  take,
  concerns,
  confidence,
  className,
}: SpecialistPerspectiveCardProps) {
  const emoji = getSpecialistEmoji(name);

  // Determine badge color based on confidence
  const getBadgeColor = (conf: ConfidenceLevel) => {
    switch (conf) {
      case 'exploring':
        return 'bg-warning-light text-accent-orange border-accent-orange/20';
      case 'forming':
        return 'bg-accent-light text-accent-purple border-accent-purple/20';
      case 'confident':
        return 'bg-success-light text-accent-green border-accent-green/20';
    }
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg bg-bg-card border border-border-subtle',
        'hover:border-border-default transition-colors',
        className,
      )}
    >
      {/* Header: emoji + name */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl" role="img" aria-label={name}>
          {emoji}
        </span>
        <span className="font-medium text-sm text-text-primary capitalize">
          {name}
        </span>
      </div>

      {/* Take */}
      {take && (
        <div className="mb-2">
          <p className="text-xs text-text-secondary leading-relaxed">{take}</p>
        </div>
      )}

      {/* Concerns */}
      {concerns && concerns.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-text-muted mb-1">Concerns:</p>
          <ul className="space-y-0.5">
            {concerns.map((concern, idx) => (
              <li
                key={idx}
                className="text-xs text-text-secondary flex items-start gap-1.5"
              >
                <span className="text-text-muted mt-0.5">•</span>
                <span className="flex-1">{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence badge */}
      <div className="flex items-center justify-end">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border',
            'uppercase tracking-wide',
            getBadgeColor(confidence),
          )}
        >
          {confidence}
        </span>
      </div>
    </div>
  );
}

/**
 * EmptyState - Shown when AI is still analyzing
 */
function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-hover flex items-center justify-center mb-3">
        <span className="text-2xl">🤔</span>
      </div>
      <p className="text-sm text-text-muted">{children}</p>
    </div>
  );
}

/**
 * AIUnderstandingDrawer
 *
 * A slide-in drawer from the right side showing AI understanding with:
 * - Idea summary section
 * - Overall confidence bar
 * - Specialist perspectives with synthesized takes
 *
 * Features:
 * - Smooth slide-in/out transition
 * - Fixed position overlay on right side
 * - Scrollable content area
 * - Close button and backdrop click support
 *
 * Layout Structure:
 * ```
 * ┌─────────────────────────────────┐
 * │  AI Understanding          [X] │
 * ├─────────────────────────────────┤
 * │  Idea Summary                   │
 * │  ─────────────────────────────  │
 * │  [AI-generated synopsis]        │
 * │                                 │
 * ├─────────────────────────────────┤
 * │  Overall Confidence             │
 * │  ▓▓▓▓▓▓▓▓░░░░░░░░ 65%          │
 * │                                 │
 * ├─────────────────────────────────┤
 * │  Specialist Perspectives        │
 * │  ┌───────────────────────────┐  │
 * │  │ 🏗️ Architect              │  │
 * │  │ Take: REST API fits...    │  │
 * │  │ Concerns: • Scaling       │  │
 * │  │ Confidence: Forming       │  │
 * │  └───────────────────────────┘  │
 * └─────────────────────────────────┘
 * ```
 *
 * Usage:
 * ```tsx
 * <AIUnderstandingDrawer
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   sessionId="session-123"
 *   synthesized={{
 *     idea_summary: 'Building a task management system...',
 *     specialist_perspectives: {
 *       architect: {
 *         take: 'REST API fits well with CRUD operations',
 *         concerns: ['Scaling concerns', 'Real-time updates'],
 *         confidence: 'forming',
 *       },
 *       designer: {
 *         take: 'Simple form flow works for MVP',
 *         concerns: ['Mobile UX needs work'],
 *         confidence: 'confident',
 *       },
 *     },
 *   }}
 * />
 * ```
 */
export function AIUnderstandingDrawer({
  isOpen,
  onClose,
  sessionId, // Reserved for future use (fetching data internally)
  synthesized,
  className,
}: AIUnderstandingDrawerProps) {
  // Check if we have any data to display
  const hasData =
    synthesized?.idea_summary ||
    (synthesized?.specialist_perspectives &&
      Object.keys(synthesized.specialist_perspectives).length > 0);

  // Suppress unused param warning - sessionId will be used when we add data fetching
  void sessionId;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-bg-deep/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-96 bg-bg-secondary border-l border-border-default shadow-2xl',
          'transform transition-transform duration-300 ease-in-out z-50',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-tertiary">
          <h2
            id="drawer-title"
            className="text-lg font-semibold text-text-primary"
          >
            AI Understanding
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center',
              'text-text-muted hover:text-text-primary',
              'hover:bg-bg-hover transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-color',
            )}
            aria-label="Close drawer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-64px)]">
          {!hasData ? (
            <EmptyState>AI is still analyzing your idea...</EmptyState>
          ) : (
            <>
              {/* Idea Summary */}
              {synthesized?.idea_summary && (
                <section>
                  <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                    Idea Summary
                  </h3>
                  <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {synthesized.idea_summary}
                    </p>
                  </div>
                </section>
              )}

              {/* Overall Confidence */}
              {synthesized?.specialist_perspectives &&
                Object.keys(synthesized.specialist_perspectives).length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                      Overall Confidence
                    </h3>
                    <OverallConfidenceBar
                      specialists={synthesized.specialist_perspectives}
                    />
                  </section>
                )}

              {/* Specialist Perspectives */}
              {synthesized?.specialist_perspectives &&
                Object.keys(synthesized.specialist_perspectives).length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                      Specialist Perspectives
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(synthesized.specialist_perspectives).map(
                        ([name, perspective]) => (
                          <SpecialistPerspectiveCard
                            key={name}
                            name={name}
                            take={perspective.take}
                            concerns={perspective.concerns}
                            confidence={perspective.confidence}
                          />
                        ),
                      )}
                    </div>
                  </section>
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

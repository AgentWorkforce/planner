/**
 * TriagePanel Component
 *
 * Fixed panel for managing question queue when > 5 questions pending.
 * Shows scrollable list of questions with priority indicators.
 * Provides bulk actions for FYI dismissal and answering top question.
 */

import { useMemo } from 'react';
import { QueueItem } from './QueueItem';
import { Button } from './ui/Button';
import type { Question } from '@/types/plan';

interface TriagePanelProps {
  /** Questions in the queue */
  questions: Question[];
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback when a question is selected */
  onSelectQuestion: (question: Question) => void;
  /** Callback to answer the top question */
  onAnswerTop: () => void;
  /** Callback to dismiss all FYI questions */
  onDismissFyi: () => void;
  /** Currently selected question ID */
  selectedQuestionId?: string;
}

export function TriagePanel({
  questions,
  isOpen,
  onClose,
  onSelectQuestion,
  onAnswerTop,
  onDismissFyi,
  selectedQuestionId,
}: TriagePanelProps) {
  // Count FYI questions for the dismiss button
  const fyiCount = useMemo(() => {
    return questions.filter((q) => q.blocking_level === 'fyi').length;
  }, [questions]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop to catch outside clicks */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-4 bottom-16 w-80 max-h-[60vh] bg-bg-tertiary border border-border-subtle rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary">
            Questions ({questions.length})
          </h3>
          <button
            type="button"
            className="p-1 hover:bg-bg-tertiary rounded text-text-muted transition-colors"
            onClick={onClose}
            aria-label="Close triage panel"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current"
            >
              <path
                d="M1 1L13 13M1 13L13 1"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Queue list */}
        <div className="overflow-y-auto max-h-[45vh] divide-y divide-border-subtle">
          {questions.length === 0 ? (
            <div className="px-3 py-8 text-center text-text-muted text-sm">
              No pending questions
            </div>
          ) : (
            questions.map((question) => (
              <QueueItem
                key={question.question_id}
                question={question}
                isSelected={question.question_id === selectedQuestionId}
                onClick={() => onSelectQuestion(question)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {questions.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-t border-border-subtle">
            {fyiCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={onDismissFyi}>
                Dismiss FYI ({fyiCount})
              </Button>
            ) : (
              <div /> // Spacer
            )}
            <Button variant="default" size="sm" onClick={onAnswerTop}>
              Answer Top &rarr;
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

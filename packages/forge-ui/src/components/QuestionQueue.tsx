/**
 * QuestionQueue - Display list of pending questions from agents
 *
 * Shows pending questions sorted by priority_score (highest first).
 * Questions with the same text are grouped into a single card.
 * Provides empty state when no questions are pending.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { QuestionCard } from './QuestionCard';
import { EmptyState } from './EmptyState';
import type { Question, QuestionGroup } from '@/types';

interface QuestionQueueProps {
  /** List of pending questions */
  questions: Question[];
  /** Called when a question is answered */
  onAnswer: (questionIds: string[], answer: string) => Promise<void>;
  /** Called when a question is dismissed */
  onDismiss?: (questionIds: string[]) => Promise<void>;
  /** Whether the queue is loading */
  isLoading?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Group questions by their text and calculate combined priority
 */
function groupQuestions(questions: Question[]): QuestionGroup[] {
  const groups = new Map<string, Question[]>();

  // Group by question text
  for (const question of questions) {
    const existing = groups.get(question.text) || [];
    existing.push(question);
    groups.set(question.text, existing);
  }

  // Convert to QuestionGroup array
  const result: QuestionGroup[] = [];
  for (const [text, groupQuestions] of groups) {
    // Calculate combined priority (max of all questions in group)
    const combinedPriority = Math.max(
      ...groupQuestions.map((q) => q.priority_score)
    );

    // Count unique agents
    const agentIds = new Set(groupQuestions.map((q) => q.agent_id));

    result.push({
      text,
      questions: groupQuestions,
      combined_priority: combinedPriority,
      agents_count: agentIds.size,
    });
  }

  // Sort by combined priority (highest first)
  result.sort((a, b) => b.combined_priority - a.combined_priority);

  return result;
}

export function QuestionQueue({
  questions,
  onAnswer,
  onDismiss,
  isLoading,
  className,
}: QuestionQueueProps) {
  // Group and sort questions
  const questionGroups = useMemo(
    () => groupQuestions(questions),
    [questions]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <QuestionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (questionGroups.length === 0) {
    return (
      <EmptyState
        title="No pending questions"
        description="All agent questions have been answered. New questions will appear here when agents need your input."
        icon={<QuestionEmptyIcon className="h-12 w-12 text-text-muted" />}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Pending Questions
        </h2>
        <span className="text-sm text-text-muted">
          {questions.length} question{questions.length !== 1 ? 's' : ''} from{' '}
          {questionGroups.length} topic{questionGroups.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {questionGroups.map((group) => (
          <QuestionCard
            key={group.text}
            question={group.questions[0]}
            group={group.questions.length > 1 ? group : undefined}
            onAnswer={onAnswer}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for question cards
 */
function QuestionCardSkeleton() {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-bg-deep rounded-lg" />
        <div className="flex-1">
          <div className="h-5 bg-bg-deep rounded w-3/4 mb-2" />
          <div className="h-4 bg-bg-deep rounded w-1/2" />
        </div>
        <div className="w-20 h-6 bg-bg-deep rounded" />
      </div>
      <div className="flex gap-4 mt-3">
        <div className="h-4 bg-bg-deep rounded w-24" />
        <div className="h-4 bg-bg-deep rounded w-24" />
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-bg-deep rounded" />
          <div className="w-20 h-9 bg-bg-deep rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state icon
 */
function QuestionEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

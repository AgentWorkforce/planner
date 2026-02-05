/**
 * QuestionCard - Display card for a pending question requiring an answer
 *
 * Shows question text, agent name (or 'Asked by N agents' for groups),
 * task title, blocking level badge, priority factors, and answer controls.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BlockingLevelBadge } from './BlockingLevelBadge';
import type { Question, QuestionGroup } from '@/types';

interface QuestionCardProps {
  /** Single question or grouped questions */
  question: Question;
  /** If this is a group of questions with same text */
  group?: QuestionGroup;
  /** Called when answer is submitted */
  onAnswer: (questionIds: string[], answer: string) => Promise<void>;
  /** Called when question is dismissed */
  onDismiss?: (questionIds: string[]) => Promise<void>;
  className?: string;
}

/**
 * Format time waiting as human-readable string
 */
function formatWaitingTime(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - created;

  if (diffMs < 0) return 'Just now';

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ago`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
}

export function QuestionCard({
  question,
  group,
  onAnswer,
  onDismiss,
  className,
}: QuestionCardProps) {
  const [customAnswer, setCustomAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [isAgentsExpanded, setIsAgentsExpanded] = useState(false);

  // Determine if this is a grouped question
  const isGrouped = group && group.questions.length > 1;
  const questions = isGrouped ? group.questions : [question];
  const questionIds = questions.map((q) => q.question_id);

  // Use the first question for display (they have the same text)
  const displayQuestion = question;

  // Priority factors
  const stepsBlocked = displayQuestion.steps_blocked;
  const agentsWaiting = displayQuestion.subscribers.length;

  // Get border color based on blocking level
  const borderColor = {
    hard_block: 'border-red-500/20 hover:border-red-500/40',
    soft_block: 'border-amber-500/20 hover:border-amber-500/40',
    preference: 'border-cyan-500/20 hover:border-cyan-500/40',
    fyi: 'border-cyan-500/20 hover:border-cyan-500/40',
  }[displayQuestion.blocking_level] || 'border-border';

  const handleSubmitAnswer = async (answer: string) => {
    if (!answer.trim()) return;

    setIsSubmitting(true);
    try {
      await onAnswer(questionIds, answer);
    } finally {
      setIsSubmitting(false);
      setCustomAnswer('');
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss) return;

    setIsSubmitting(true);
    try {
      await onDismiss(questionIds);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'relative bg-bg-card border rounded-lg p-4',
        'transition-colors',
        borderColor,
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Question icon */}
        <div className="flex-shrink-0 p-2 bg-accent-cyan/10 rounded-lg">
          <QuestionIcon className="h-5 w-5 text-accent-cyan" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Question text */}
          <p className="font-medium text-text-primary">
            {displayQuestion.text}
          </p>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-text-muted">
            {/* Agent name or grouped count */}
            {isGrouped ? (
              <button
                onClick={() => setIsAgentsExpanded(!isAgentsExpanded)}
                className="flex items-center gap-1 hover:text-text-primary transition-colors"
              >
                <UsersIcon className="h-3.5 w-3.5" />
                <span>Asked by {group.agents_count} agents</span>
                <ChevronIcon
                  className={cn(
                    'h-3 w-3 transition-transform',
                    isAgentsExpanded && 'rotate-180'
                  )}
                />
              </button>
            ) : (
              <span className="flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" />
                {displayQuestion.agent_name || displayQuestion.agent_id}
              </span>
            )}

            <span className="text-text-dim">|</span>

            {/* Task title */}
            {displayQuestion.task_title && (
              <>
                <span className="truncate max-w-[200px]">
                  {displayQuestion.task_title}
                </span>
                <span className="text-text-dim">|</span>
              </>
            )}

            {/* Time */}
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {formatWaitingTime(displayQuestion.created_at)}
            </span>
          </div>

          {/* Expanded agent list */}
          {isGrouped && isAgentsExpanded && (
            <div className="mt-2 pl-4 border-l-2 border-border text-sm text-text-muted">
              {group.questions.map((q) => (
                <div key={q.question_id} className="py-0.5">
                  {q.agent_name || q.agent_id}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocking level badge */}
        <BlockingLevelBadge level={displayQuestion.blocking_level} />
      </div>

      {/* Priority indicators */}
      <div className="flex items-center gap-4 mt-3 text-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-text-muted">
              <BlockedIcon className="h-4 w-4 text-amber-500" />
              <span>{stepsBlocked} step{stepsBlocked !== 1 ? 's' : ''} blocked</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Number of downstream steps waiting for this question
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-text-muted">
              <UsersIcon className="h-4 w-4 text-cyan-500" />
              <span>{agentsWaiting} agent{agentsWaiting !== 1 ? 's' : ''} waiting</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Number of agents subscribed to this question's answer
          </TooltipContent>
        </Tooltip>

        {/* Priority score tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-text-muted ml-auto">
              <PriorityIcon className="h-4 w-4" />
              <span>Priority: {displayQuestion.priority_score}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Priority calculated from: blocking level, steps blocked, agents waiting, and time pending
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Context section (expandable) */}
      {displayQuestion.context && (
        <div className="mt-3">
          <button
            onClick={() => setIsContextExpanded(!isContextExpanded)}
            className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronIcon
              className={cn(
                'h-3 w-3 transition-transform',
                isContextExpanded && 'rotate-180'
              )}
            />
            <span>Context</span>
          </button>
          {isContextExpanded && (
            <div className="mt-2 p-3 bg-bg-deep rounded-md text-sm text-text-secondary">
              {displayQuestion.context}
            </div>
          )}
        </div>
      )}

      {/* Answer section */}
      <div className="mt-4 pt-4 border-t border-border">
        {/* Pre-defined options */}
        {displayQuestion.options && displayQuestion.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {displayQuestion.options.map((option, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSubmitAnswer(option)}
                disabled={isSubmitting}
                className="border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 hover:border-accent-cyan/50"
              >
                {option}
              </Button>
            ))}
          </div>
        )}

        {/* Custom answer input */}
        <div className="flex gap-2">
          <Input
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitAnswer(customAnswer);
              }
            }}
            disabled={isSubmitting}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmitAnswer(customAnswer)}
            disabled={isSubmitting || !customAnswer.trim()}
          >
            {isSubmitting ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : (
              'Answer'
            )}
          </Button>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="text-text-muted hover:text-text-primary"
            >
              Dismiss
            </Button>
          )}
        </div>

        {/* Default value hint */}
        {displayQuestion.can_use_default && displayQuestion.default_value && (
          <p className="mt-2 text-xs text-text-muted">
            Default: {displayQuestion.default_value}
          </p>
        )}
      </div>
    </div>
  );
}

/* Icons */

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function BlockedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PriorityIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

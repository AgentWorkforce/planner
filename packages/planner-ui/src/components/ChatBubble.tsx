/**
 * ChatBubble Component
 *
 * Flashcard-style question interface for agent questions.
 * Features: context display, multiple choice with radio buttons,
 * free text input, optional reasoning, auto-proceed timer.
 *
 * Trajectory Integration:
 * - Optionally records user decisions to trajectory via onRecordDecision callback
 * - Parent component should use useUserTrajectory hook and pass recordDecision function
 * - Recording is async/non-blocking to avoid UI delays
 * - Requires planId prop for trajectory event context
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentAvatar } from './AgentAvatar';
import { Button } from './ui/Button';
import { getRoleConfig } from '@/config/agentRoles';
import type { Question } from '@/types/plan';
import type { AgentRole } from '@/hooks/useAgentOrchestration';
import type { DecisionEvent } from '@/types/trajectory';

interface ChatBubbleProps {
  /** The question to display */
  question: Question;
  /** Whether there's a next question available */
  hasNextQuestion: boolean;
  /** Callback when answer is submitted */
  onAnswer: (answer: string, reasoning?: string) => void;
  /** Callback to show next question immediately */
  onShowNext: () => void;
  /** Callback to defer to queue (show later) */
  onLater: () => void;
  /** Callback to skip this question (move to back of queue) */
  onSkip?: () => void;
  /** Callback to minimize (return to avatar state) */
  onMinimize?: () => void;
  /** Callback to dismiss/close without answering */
  onClose: () => void;
  /** Whether an action is in progress */
  isProcessing?: boolean;
  /** Auto-proceed timeout in seconds (for preference questions) */
  autoProceedDurationSeconds?: number;
  /** Plan ID (required for trajectory recording) */
  planId?: string;
  /** Callback to record decision to trajectory (async, don't block UI) */
  onRecordDecision?: (event: Omit<DecisionEvent, 'event_id' | 'timestamp'>) => void;
}

/**
 * Get blocking level badge styling.
 */
function getBlockingBadge(blockingLevel: Question['blocking_level']): {
  text: string;
  className: string;
} {
  switch (blockingLevel) {
    case 'hard_block':
      return {
        text: 'BLOCKING',
        className: 'bg-error text-white',
      };
    case 'soft_block':
      return {
        text: 'SOFT BLOCK',
        className: 'bg-warning/20 text-warning',
      };
    case 'preference':
      return {
        text: 'PREFERENCE',
        className: 'bg-warning/20 text-warning',
      };
    case 'fyi':
      return {
        text: 'FYI',
        className: 'bg-accent-cyan/20 text-accent-cyan',
      };
    default:
      return {
        text: blockingLevel,
        className: 'bg-bg-elevated text-text-muted',
      };
  }
}

/**
 * Format seconds to mm:ss display.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ChatBubble({
  question,
  hasNextQuestion,
  onAnswer,
  onShowNext,
  onLater,
  onSkip,
  onMinimize,
  onClose,
  isProcessing = false,
  autoProceedDurationSeconds = 300, // 5 minutes default
  planId,
  onRecordDecision,
}: ChatBubbleProps) {
  // Selected option (for radio buttons)
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  // Free text input for "Other" option
  const [otherText, setOtherText] = useState('');
  // Is "Other" selected?
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  // Free-form answer text (when no options)
  const [answerText, setAnswerText] = useState('');
  // Optional reasoning
  const [reasoning, setReasoning] = useState('');
  // Show next question prompt after answering
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  // Auto-proceed timer (seconds remaining)
  const [timeRemaining, setTimeRemaining] = useState(autoProceedDurationSeconds);

  const otherInputRef = useRef<HTMLInputElement>(null);

  // Check if role is valid, fallback to 'coder' if unknown
  const agentRole = (
    ['architect', 'ui-designer', 'data-modeler', 'coder', 'tester', 'security'].includes(
      question.agent_role
    )
      ? question.agent_role
      : 'coder'
  ) as AgentRole;

  const roleConfig = getRoleConfig(agentRole);
  const badge = getBlockingBadge(question.blocking_level);

  // Should show auto-proceed timer?
  const showTimer =
    question.blocking_level === 'preference' &&
    question.can_use_default &&
    question.default_value;

  // Auto-proceed timer effect
  useEffect(() => {
    if (!showTimer || showNextPrompt) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showTimer, showNextPrompt]);

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (showTimer && timeRemaining === 0) {
      onAnswer(question.default_value || '', reasoning);
    }
  }, [showTimer, timeRemaining, question.default_value, onAnswer, reasoning]);

  // Focus "Other" input when selected
  useEffect(() => {
    if (isOtherSelected && otherInputRef.current) {
      otherInputRef.current.focus();
    }
  }, [isOtherSelected]);

  const getAnswer = useCallback((): string => {
    if (question.options && question.options.length > 0) {
      if (isOtherSelected) {
        return otherText.trim();
      }
      return selectedOption || '';
    }
    return answerText.trim();
  }, [question.options, isOtherSelected, otherText, selectedOption, answerText]);

  const handleSubmitAnswer = useCallback(() => {
    const answer = getAnswer();
    if (!answer) return;

    onAnswer(answer, reasoning.trim() || undefined);

    // Record to trajectory (async, don't block UI)
    if (onRecordDecision && planId) {
      onRecordDecision({
        type: 'decision',
        question_id: question.question_id,
        asking_agent: question.agent_role,
        question_text: question.text,
        context_provided: question.context,
        options_presented: question.options || [],
        selected_option: isOtherSelected ? null : selectedOption,
        free_text_response: isOtherSelected ? otherText : undefined,
        reasoning: reasoning.trim() || undefined,
        plan_id: planId,
        step_id: undefined, // Questions are not tied to specific steps
        agent_trajectory_ref: `agent-${question.agent_role}-${question.question_id}`,
      });
    }

    // Reset state
    setSelectedOption(null);
    setOtherText('');
    setIsOtherSelected(false);
    setAnswerText('');
    setReasoning('');

    // If there's a next question, show the prompt
    if (hasNextQuestion) {
      setShowNextPrompt(true);
    }
  }, [
    getAnswer,
    onAnswer,
    reasoning,
    hasNextQuestion,
    onRecordDecision,
    planId,
    question.question_id,
    question.agent_role,
    question.text,
    question.context,
    question.options,
    isOtherSelected,
    selectedOption,
    otherText,
  ]);

  const handleOptionSelect = useCallback((option: string) => {
    setSelectedOption(option);
    setIsOtherSelected(false);
  }, []);

  const handleOtherSelect = useCallback(() => {
    setSelectedOption(null);
    setIsOtherSelected(true);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const canSubmit = (): boolean => {
    if (isProcessing) return false;
    const answer = getAnswer();
    return answer.length > 0;
  };

  // After answering, show next question prompt
  if (showNextPrompt) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40"
          onClick={onLater}
          aria-hidden="true"
        />

        {/* Next question prompt */}
        <div className="fixed right-4 bottom-16 w-72 bg-bg-tertiary border border-border-subtle rounded-xl shadow-lg p-4 z-50 animate-slide-up">
          <p className="text-sm text-accent-green mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
              <path d="M2 7l3 3 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sent to {roleConfig.label}
          </p>
          <p className="text-xs text-text-secondary mb-3">
            Another agent has a question
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onLater} className="flex-1">
              Later
            </Button>
            <Button variant="default" size="sm" onClick={onShowNext} className="flex-1">
              Show Now
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onMinimize || onClose}
        aria-hidden="true"
      />

      {/* Chat bubble - slide up animation */}
      <div className="fixed right-4 bottom-16 w-96 bg-bg-tertiary border border-border-subtle rounded-xl shadow-modal overflow-hidden z-50 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-bg-secondary border-b border-border-subtle">
          <AgentAvatar
            role={agentRole}
            state="needs_input"
            size="md"
            showTooltip={false}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {roleConfig.label}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.className}`}>
                {badge.text}
              </span>
            </div>
            {question.subscribers.length > 0 && (
              <div className="text-xs text-accent-cyan">
                +{question.subscribers.length} agent{question.subscribers.length !== 1 ? 's' : ''} waiting
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Minimize button */}
            {onMinimize && (
              <button
                type="button"
                className="p-1 hover:bg-bg-tertiary rounded text-text-muted transition-colors"
                onClick={onMinimize}
                aria-label="Minimize"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                  <path d="M2 7h10" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {/* Close button */}
            <button
              type="button"
              className="p-1 hover:bg-bg-tertiary rounded text-text-muted transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="stroke-current">
                <path d="M1 1L13 13M1 13L13 1" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context section (monospace, scrollable) */}
        {question.context && (
          <div className="px-4 py-2 max-h-32 overflow-y-auto border-b border-border-subtle bg-bg-secondary/50">
            <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-words">
              {question.context}
            </pre>
          </div>
        )}

        {/* Blocking info banner */}
        {(question.blocking_level === 'hard_block' || question.blocking_level === 'soft_block') &&
          question.steps_blocked > 0 && (
            <div className="px-4 py-2 bg-error/10 border-b border-error/20">
              <span className="text-xs text-error flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                  <path d="M6 4v2m0 2h.01M11 6a5 5 0 11-10 0 5 5 0 0110 0z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                This blocks {question.steps_blocked} other step{question.steps_blocked !== 1 ? 's' : ''}
              </span>
            </div>
          )}

        {/* Content */}
        <div className="p-4">
          {/* Question text */}
          <p className="text-sm text-text-primary font-medium mb-3">
            {question.text}
          </p>

          {/* Options as radio buttons */}
          {question.options && question.options.length > 0 ? (
            <div className="space-y-2 mb-3">
              {question.options.map((option, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedOption === option
                      ? 'bg-accent-cyan/10 border border-accent-cyan/30'
                      : 'hover:bg-bg-secondary border border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="question-option"
                    checked={selectedOption === option}
                    onChange={() => handleOptionSelect(option)}
                    className="mt-0.5 accent-accent-cyan"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-text-secondary">{option}</span>
                </label>
              ))}

              {/* "Other" option with text input */}
              <label
                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  isOtherSelected
                    ? 'bg-accent-cyan/10 border border-accent-cyan/30'
                    : 'hover:bg-bg-secondary border border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="question-option"
                  checked={isOtherSelected}
                  onChange={handleOtherSelect}
                  className="mt-0.5 accent-accent-cyan"
                  disabled={isProcessing}
                />
                <div className="flex-1">
                  <span className="text-sm text-text-secondary">Other:</span>
                  <input
                    ref={otherInputRef}
                    type="text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer..."
                    className="w-full mt-1 px-2 py-1 text-sm bg-bg-secondary border border-border-subtle rounded focus:outline-none focus:border-accent-cyan"
                    disabled={isProcessing || !isOtherSelected}
                  />
                </div>
              </label>
            </div>
          ) : (
            /* Free-form answer input */
            <div className="mb-3">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                className="w-full h-20 px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Optional reasoning (collapsible) */}
          <details className="text-xs text-text-muted mb-3">
            <summary className="cursor-pointer hover:text-text-secondary select-none">
              📝 Add reasoning (optional)
            </summary>
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Why this choice?"
              className="mt-2 w-full h-16 bg-bg-secondary border border-border-subtle rounded-md p-2 text-xs text-text-primary resize-none focus:outline-none focus:border-accent-cyan"
              disabled={isProcessing}
            />
          </details>

          {/* Default value hint */}
          {question.can_use_default && question.default_value && !showTimer && (
            <div className="text-xs text-text-muted">
              Default: {question.default_value}
            </div>
          )}
        </div>

        {/* Auto-proceed timer banner */}
        {showTimer && (
          <div className="px-4 py-2 bg-warning/10 border-t border-warning/20">
            <span className="text-xs text-warning flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                <circle cx="6" cy="6" r="5" strokeWidth="1.5" />
                <path d="M6 3v3l2 1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Will auto-proceed with "{question.default_value}" in {formatTime(timeRemaining)}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-bg-secondary border-t border-border-subtle">
          <div className="flex items-center gap-2">
            {onSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                disabled={isProcessing}
              >
                Skip for now
              </Button>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmitAnswer}
            disabled={!canSubmit()}
          >
            {isProcessing ? 'Sending...' : 'Send →'}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * useQuestions - Hook for fetching and subscribing to pending questions
 *
 * Provides pending questions data with SSE subscription for real-time updates
 * on question_added and question_answered events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listPendingQuestions, answerQuestion, answerQuestionGroup, dismissQuestion } from '@/api';
import { FORGE_API_BASE } from '@/api/client';
import type { Question } from '@/types';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

interface UseQuestionsOptions {
  /** Filter questions by run ID */
  runId?: string;
  /** Whether the hook is enabled */
  enabled?: boolean;
  /** Callback when a new question is added */
  onQuestionAdded?: (question: Question) => void;
}

interface UseQuestionsResult {
  /** List of pending questions sorted by priority */
  questions: Question[];
  /** Number of pending questions */
  count: number;
  /** Whether questions are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether SSE is connected */
  isConnected: boolean;
  /** Refetch questions from API */
  refetch: () => Promise<void>;
  /** Answer a single question */
  answer: (questionId: string, answer: string) => Promise<void>;
  /** Answer multiple questions at once */
  answerGroup: (questionIds: string[], answer: string) => Promise<void>;
  /** Dismiss a question */
  dismiss: (questionId: string) => Promise<void>;
}

export function useQuestions(options: UseQuestionsOptions = {}): UseQuestionsResult {
  const { runId, enabled = true, onQuestionAdded } = options;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Stable references for callbacks
  const onQuestionAddedRef = useRef(onQuestionAdded);
  onQuestionAddedRef.current = onQuestionAdded;

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch pending questions
  const fetchQuestions = useCallback(async () => {
    if (!enabled) {
      setQuestions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await listPendingQuestions(runId);
      // Sort by priority score (highest first)
      const sorted = [...data].sort((a, b) => b.priority_score - a.priority_score);
      setQuestions(sorted);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch questions'));
    } finally {
      setIsLoading(false);
    }
  }, [runId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const connect = () => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Determine SSE endpoint - either run-specific or global questions
      const sseUrl = runId
        ? `${FORGE_API_BASE}/runs/${runId}/events`
        : `${FORGE_API_BASE}/questions/events`;

      try {
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          retryCountRef.current = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as QuestionEvent;
            handleQuestionEvent(data);
          } catch (err) {
            console.error('[useQuestions] Failed to parse event:', err);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          retryCountRef.current += 1;

          if (retryCountRef.current >= MAX_RETRIES) {
            eventSource.close();
            eventSourceRef.current = null;
            setError(new Error('Max reconnection attempts reached'));
            return;
          }

          // Calculate exponential backoff delay
          const delay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1),
            MAX_RETRY_DELAY
          );

          // Clear any existing retry timeout
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          // Schedule reconnection
          retryTimeoutRef.current = setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              connect();
            }
          }, delay);
        };
      } catch (err) {
        console.error('[useQuestions] Failed to create EventSource:', err);
        setError(err instanceof Error ? err : new Error('Failed to connect'));
        setIsConnected(false);
      }
    };

    function handleQuestionEvent(event: QuestionEvent) {
      switch (event.type) {
        case 'question_added':
          // Add new question to list
          if (event.data.question) {
            setQuestions((prev) => {
              // Avoid duplicates
              if (prev.some((q) => q.question_id === event.data.question!.question_id)) {
                return prev;
              }

              // Notify callback
              onQuestionAddedRef.current?.(event.data.question!);

              // Add and re-sort
              const updated = [...prev, event.data.question!];
              return updated.sort((a, b) => b.priority_score - a.priority_score);
            });
          } else {
            // If no question data in event, refetch
            fetchQuestions();
          }
          break;

        case 'question_answered':
          // Remove question from pending list
          setQuestions((prev) =>
            prev.filter((q) => q.question_id !== event.data.question_id)
          );
          break;

        case 'question_dismissed':
          // Remove question from pending list
          setQuestions((prev) =>
            prev.filter((q) => q.question_id !== event.data.question_id)
          );
          break;

        default:
          // Unknown event type, refetch to be safe
          fetchQuestions();
      }
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setIsConnected(false);
    };
  }, [runId, enabled, fetchQuestions]);

  // Answer a single question
  const answer = useCallback(async (questionId: string, answerText: string) => {
    // Optimistic update - remove from list
    setQuestions((prev) =>
      prev.filter((q) => q.question_id !== questionId)
    );

    try {
      await answerQuestion(questionId, answerText);
    } catch (err) {
      // Revert on error - refetch to restore state
      await fetchQuestions();
      throw err;
    }
  }, [fetchQuestions]);

  // Answer multiple questions at once
  const answerGroupFn = useCallback(async (questionIds: string[], answerText: string) => {
    // Optimistic update - remove all from list
    setQuestions((prev) =>
      prev.filter((q) => !questionIds.includes(q.question_id))
    );

    try {
      await answerQuestionGroup(questionIds, answerText);
    } catch (err) {
      // Revert on error - refetch to restore state
      await fetchQuestions();
      throw err;
    }
  }, [fetchQuestions]);

  // Dismiss a question
  const dismiss = useCallback(async (questionId: string) => {
    // Optimistic update - remove from list
    setQuestions((prev) =>
      prev.filter((q) => q.question_id !== questionId)
    );

    try {
      await dismissQuestion(questionId);
    } catch (err) {
      // Revert on error - refetch to restore state
      await fetchQuestions();
      throw err;
    }
  }, [fetchQuestions]);

  return {
    questions,
    count: questions.length,
    isLoading,
    error,
    isConnected,
    refetch: fetchQuestions,
    answer,
    answerGroup: answerGroupFn,
    dismiss,
  };
}

// Question-specific event types
interface QuestionEvent {
  type: 'question_added' | 'question_answered' | 'question_dismissed';
  run_id?: string;
  timestamp: string;
  data: {
    question_id: string;
    question?: Question;
    answer?: string;
    answered_by?: string;
  };
}

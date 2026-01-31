/**
 * useQuestionQueue Hook
 *
 * Manages the question queue for a plan, including fetching questions,
 * answering, dismissing, and subscribing to questions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Question } from '@/types/plan';
import {
  getQuestions,
  answerQuestion as apiAnswerQuestion,
  dismissQuestion as apiDismissQuestion,
  subscribeToQuestion as apiSubscribeToQuestion,
} from '@/api/questions';

interface UseQuestionQueueOptions {
  /** Poll interval in ms (0 to disable polling) */
  pollInterval?: number;
}

interface UseQuestionQueueResult {
  /** All pending questions sorted by priority */
  questions: Question[];
  /** The highest priority pending question */
  currentQuestion: Question | null;
  /** Total count of pending questions */
  count: number;
  /** Whether loading is in progress */
  isLoading: boolean;
  /** ID of question currently being processed */
  processingId: string | null;
  /** Error message if any */
  error: string | null;
  /** Refresh the question list */
  refresh: () => Promise<void>;
  /** Answer a question */
  answer: (questionId: string, answerText: string) => Promise<Question | null>;
  /** Dismiss a question (use default or skip) */
  dismiss: (questionId: string) => Promise<boolean>;
  /** Subscribe to a question's answer */
  subscribe: (questionId: string, agentId: string) => Promise<Question | null>;
  /** Get questions filtered by blocking level */
  getByBlockingLevel: (level: Question['blocking_level']) => Question[];
  /** Check if there are hard-blocking questions */
  hasHardBlocks: boolean;
}

/**
 * Hook for managing the question queue for a plan.
 */
export function useQuestionQueue(
  planId: string | null,
  options: UseQuestionQueueOptions = {}
): UseQuestionQueueResult {
  const { pollInterval = 0 } = options;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!planId) {
      setQuestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getQuestions(planId);
      // Questions are already sorted by priority from API
      setQuestions(response.questions.filter((q) => q.status === 'pending'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch questions';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  // Initial fetch
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const intervalId = setInterval(fetchQuestions, pollInterval);
    return () => clearInterval(intervalId);
  }, [fetchQuestions, pollInterval]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!planId) return;

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const eventSource = new EventSource(`${API_BASE}/plans/${planId}/events`);

    const handleQuestionEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { eventType, question } = data;

        switch (eventType) {
          case 'question_added':
            // Add new question and re-sort by priority
            setQuestions((prev) => {
              // Check for duplicates
              if (prev.some((q) => q.question_id === question.question_id)) {
                return prev;
              }
              const updated = [...prev, question];
              return updated.sort((a, b) => b.priority_score - a.priority_score);
            });
            break;

          case 'question_answered':
          case 'question_dismissed':
            // Remove from queue
            setQuestions((prev) =>
              prev.filter((q) => q.question_id !== question.question_id)
            );
            break;

          case 'question_subscribed':
            // Update subscriber count
            setQuestions((prev) =>
              prev.map((q) =>
                q.question_id === question.question_id ? question : q
              )
            );
            break;
        }
      } catch {
        // Ignore parse errors from SSE
      }
    };

    eventSource.addEventListener('question_event', handleQuestionEvent);

    eventSource.onerror = () => {
      // EventSource will automatically reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [planId]);

  const answer = useCallback(
    async (questionId: string, answerText: string): Promise<Question | null> => {
      if (!planId) return null;

      setProcessingId(questionId);
      setError(null);

      try {
        const response = await apiAnswerQuestion(planId, questionId, { answer: answerText });
        // Update local state
        setQuestions((prev) =>
          prev.filter((q) => q.question_id !== questionId)
        );
        return response.question;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to answer question';
        setError(errorMessage);
        return null;
      } finally {
        setProcessingId(null);
      }
    },
    [planId]
  );

  const dismiss = useCallback(
    async (questionId: string): Promise<boolean> => {
      if (!planId) return false;

      setProcessingId(questionId);
      setError(null);

      try {
        const response = await apiDismissQuestion(planId, questionId);
        if (response.success) {
          // Update local state
          setQuestions((prev) =>
            prev.filter((q) => q.question_id !== questionId)
          );
        }
        return response.success;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to dismiss question';
        setError(errorMessage);
        return false;
      } finally {
        setProcessingId(null);
      }
    },
    [planId]
  );

  const subscribe = useCallback(
    async (questionId: string, agentId: string): Promise<Question | null> => {
      if (!planId) return null;

      setProcessingId(questionId);
      setError(null);

      try {
        const response = await apiSubscribeToQuestion(planId, questionId, agentId);
        // Update local state with new subscriber count
        setQuestions((prev) =>
          prev.map((q) =>
            q.question_id === questionId ? response.question : q
          )
        );
        return response.question;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe';
        setError(errorMessage);
        return null;
      } finally {
        setProcessingId(null);
      }
    },
    [planId]
  );

  const getByBlockingLevel = useCallback(
    (level: Question['blocking_level']) => {
      return questions.filter((q) => q.blocking_level === level);
    },
    [questions]
  );

  const currentQuestion = useMemo(() => {
    return questions.length > 0 ? questions[0] : null;
  }, [questions]);

  const hasHardBlocks = useMemo(() => {
    return questions.some((q) => q.blocking_level === 'hard_block');
  }, [questions]);

  return {
    questions,
    currentQuestion,
    count: questions.length,
    isLoading,
    processingId,
    error,
    refresh: fetchQuestions,
    answer,
    dismiss,
    subscribe,
    getByBlockingLevel,
    hasHardBlocks,
  };
}

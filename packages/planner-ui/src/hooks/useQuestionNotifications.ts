/**
 * useQuestionNotifications Hook
 *
 * Manages the notification queue for new agent questions.
 * When questions are added to the queue, shows them one at a time
 * as mini notification bubbles above agent avatars in the status bar.
 *
 * Features:
 * - Queues new questions as they arrive (via SSE events)
 * - Shows one notification at a time for 5 seconds
 * - Auto-advances to next notification after timeout
 * - dismiss() immediately advances the queue
 * - Provides current notification with agentId for avatar matching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Question } from '@/types/plan';

/** Notification with question and matching agent info */
export interface QuestionNotification {
  question: Question;
  agentId: string;
}

interface UseQuestionNotificationsOptions {
  /** Time in ms before auto-advancing to next notification (default: 5000) */
  autoAdvanceDelay?: number;
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: QuestionNotification) => void;
}

interface UseQuestionNotificationsResult {
  /** Currently displayed notification (null if queue is empty) */
  currentNotification: QuestionNotification | null;
  /** Dismiss current notification and advance to next */
  dismiss: () => void;
  /** All queued notifications (including current) */
  queue: QuestionNotification[];
  /** Add a question to the notification queue */
  addToQueue: (question: Question) => void;
}

/**
 * Hook for managing question notification queue.
 *
 * @param options - Configuration options
 * @returns Notification state and controls
 */
export function useQuestionNotifications(
  options: UseQuestionNotificationsOptions = {}
): UseQuestionNotificationsResult {
  const { autoAdvanceDelay = 5000, onNotificationClick } = options;

  const [queue, setQueue] = useState<QuestionNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNotificationClickRef = useRef(onNotificationClick);

  // Keep callback ref current
  useEffect(() => {
    onNotificationClickRef.current = onNotificationClick;
  }, [onNotificationClick]);

  // Current notification is first in queue
  const currentNotification = queue.length > 0 ? queue[0]! : null;

  // Advance to next notification
  const advance = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // Dismiss current notification
  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    advance();
  }, [advance]);

  // Add question to queue
  const addToQueue = useCallback((question: Question) => {
    const notification: QuestionNotification = {
      question,
      agentId: question.agent_id,
    };

    setQueue((prev) => {
      // Avoid duplicates
      if (prev.some((n) => n.question.question_id === question.question_id)) {
        return prev;
      }
      return [...prev, notification];
    });
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!currentNotification) {
      return;
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set timer to auto-advance
    timerRef.current = setTimeout(() => {
      advance();
    }, autoAdvanceDelay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentNotification, autoAdvanceDelay, advance]);

  return {
    currentNotification,
    dismiss,
    queue,
    addToQueue,
  };
}

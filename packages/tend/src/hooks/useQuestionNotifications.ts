/**
 * useQuestionNotifications Hook
 *
 * Manages the notification queue for new questions.
 * When questions are added to the queue, shows them one at a time
 * as mini notification bubbles above agent avatars in the status bar.
 *
 * Features:
 * - Queues new questions as they arrive (via project events)
 * - Shows one notification at a time with configurable duration
 * - Auto-advances to next notification after timeout
 * - dismiss() immediately advances the queue
 * - Provides current notification with agentId for avatar matching
 *
 * Timing configuration:
 * - Blocking questions: 30 seconds
 * - Normal questions: 15 seconds
 * - FYI questions: 8 seconds
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type QuestionPriority = 'blocking' | 'normal' | 'fyi';

export interface Question {
  question_id: string;
  agent_id: string;
  text: string;
  priority?: QuestionPriority;
  created_at: string;
}

/** Notification with question and matching agent info */
export interface QuestionNotification {
  question: Question;
  agentId: string;
}

interface UseQuestionNotificationsOptions {
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

// Duration based on priority
const DURATION_MS: Record<QuestionPriority, number> = {
  blocking: 30000, // 30 seconds
  normal: 15000, // 15 seconds
  fyi: 8000, // 8 seconds
};

/**
 * Hook for managing question notification queue.
 *
 * @param options - Configuration options
 * @returns Notification state and controls
 */
export function useQuestionNotifications(
  options: UseQuestionNotificationsOptions = {}
): UseQuestionNotificationsResult {
  const { onNotificationClick } = options;

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

  // Auto-advance timer with priority-based duration
  useEffect(() => {
    if (!currentNotification) {
      return;
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Get duration based on priority
    const priority = currentNotification.question.priority || 'normal';
    const duration = DURATION_MS[priority];

    // Set timer to auto-advance
    timerRef.current = setTimeout(() => {
      advance();
    }, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentNotification, advance]);

  return {
    currentNotification,
    dismiss,
    queue,
    addToQueue,
  };
}

/**
 * Question Event Emitter
 *
 * Provides pub/sub for question events, enabling real-time sync
 * between backend modifications and connected UI clients via SSE.
 */

import { EventEmitter } from 'events';
import type { Question } from '../domain/question.js';

/**
 * Types of question events that can be emitted.
 */
export type QuestionEventType =
  | 'question_added'
  | 'question_answered'
  | 'question_dismissed'
  | 'question_subscribed';

/**
 * Data emitted with question events.
 */
export interface QuestionEvent {
  planId: string;
  questionId: string;
  eventType: QuestionEventType;
  question: Question;
  timestamp: string;
}

/**
 * Callback type for question event listeners.
 */
export type QuestionEventCallback = (event: QuestionEvent) => void;

/**
 * Internal emitter instance.
 * Uses planId as event name for efficient per-plan subscriptions.
 */
const emitter = new EventEmitter();

// Increase max listeners to support many SSE connections
emitter.setMaxListeners(100);

/**
 * Emit a question event to all listeners for the given planId.
 *
 * @param planId - The plan the question belongs to
 * @param questionId - The question that changed
 * @param eventType - Type of event that occurred
 * @param question - The full question data
 */
export function emitQuestionEvent(
  planId: string,
  questionId: string,
  eventType: QuestionEventType,
  question: Question
): void {
  const event: QuestionEvent = {
    planId,
    questionId,
    eventType,
    question,
    timestamp: new Date().toISOString(),
  };

  // Emit to the plan-specific channel for question events
  emitter.emit(`questions:${planId}`, event);
}

/**
 * Subscribe to question events for a specific plan.
 *
 * @param planId - The plan to listen for question events on
 * @param callback - Function called when a question event occurs
 */
export function onQuestionEvent(planId: string, callback: QuestionEventCallback): void {
  emitter.on(`questions:${planId}`, callback);
}

/**
 * Unsubscribe from question events.
 *
 * @param planId - The plan to stop listening to
 * @param callback - The specific callback to remove
 */
export function offQuestionEvent(planId: string, callback: QuestionEventCallback): void {
  emitter.off(`questions:${planId}`, callback);
}

/**
 * Get the current listener count for question events on a plan.
 *
 * @param planId - The plan to check
 * @returns Number of listeners for question events
 */
export function getQuestionListenerCount(planId: string): number {
  return emitter.listenerCount(`questions:${planId}`);
}

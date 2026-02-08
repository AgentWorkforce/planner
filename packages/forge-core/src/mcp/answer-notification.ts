import type { ForgeStorage } from '../storage/interface.js';
import { TaskStatus } from '../domain/types.js';

// ============================================
// Types
// ============================================

/**
 * Message sent to agents when a question is answered
 */
export interface QuestionAnsweredMessage {
  type: 'question_answered';
  question_id: string;
  answer: string;
  answered_by?: string;
  timestamp: string;
}

/**
 * Callback type for sending relay messages
 */
export type SendRelayMessageFn = (
  agentId: string,
  message: QuestionAnsweredMessage
) => void;

/**
 * Result of notifying agents about an answered question
 */
export interface NotifyAgentsResult {
  question_id: string;
  notified_agents: string[];
  tasks_unblocked: string[];
}

// ============================================
// Answer Notification Service
// ============================================

/**
 * AnswerNotificationService handles notifying agents when their questions are answered
 * and unblocking tasks that were waiting for answers.
 */
export class AnswerNotificationService {
  private storage: ForgeStorage;
  private sendRelayMessage?: SendRelayMessageFn;

  constructor(
    storage: ForgeStorage,
    options?: {
      sendRelayMessage?: SendRelayMessageFn;
    }
  ) {
    this.storage = storage;
    this.sendRelayMessage = options?.sendRelayMessage;
  }

  /**
   * Sets or updates the relay message sender
   */
  setSendRelayMessage(fn: SendRelayMessageFn): void {
    this.sendRelayMessage = fn;
  }

  /**
   * Notifies agents that a question has been answered.
   *
   * This method:
   * 1. Gets all agents that need to be notified (original agent + subscribers)
   * 2. Sends relay messages to each agent
   * 3. Unblocks any tasks that were blocked waiting for this answer
   *
   * @param questionId - The ID of the answered question
   * @returns Result containing notified agents and unblocked tasks
   */
  notifyQuestionAnswered(questionId: string): NotifyAgentsResult {
    const question = this.storage.getQuestion(questionId);
    if (!question) {
      return {
        question_id: questionId,
        notified_agents: [],
        tasks_unblocked: [],
      };
    }

    // Collect all agents to notify
    const agentsToNotify = new Set<string>();
    agentsToNotify.add(question.agent_id);
    for (const subscriber of question.subscribers) {
      agentsToNotify.add(subscriber);
    }

    const notifiedAgents: string[] = [];
    const timestamp = new Date().toISOString();

    // Create the notification message
    const message: QuestionAnsweredMessage = {
      type: 'question_answered',
      question_id: questionId,
      answer: question.answer ?? '',
      answered_by: question.answered_by,
      timestamp,
    };

    // Send messages to all agents
    if (this.sendRelayMessage) {
      for (const agentId of agentsToNotify) {
        try {
          this.sendRelayMessage(agentId, message);
          notifiedAgents.push(agentId);
        } catch (err) {
          console.error(
            `[AnswerNotification] Failed to notify agent ${agentId}:`,
            err
          );
        }
      }
    }

    // Unblock tasks if question was blocking
    const tasksUnblocked: string[] = [];
    if (
      question.task_id &&
      (question.blocking_level === 'hard_block' ||
        question.blocking_level === 'soft_block')
    ) {
      const task = this.storage.getTask(question.task_id);
      if (task && task.status === 'blocked') {
        // Update task to running status
        const updatedTask = this.storage.updateTaskStatus(
          question.task_id,
          TaskStatus.Running
        );
        if (updatedTask) {
          tasksUnblocked.push(question.task_id);
        }
      }
    }

    return {
      question_id: questionId,
      notified_agents: notifiedAgents,
      tasks_unblocked: tasksUnblocked,
    };
  }

  /**
   * Helper to check if a question answer should trigger task unblocking
   */
  shouldUnblockTask(questionId: string): boolean {
    const question = this.storage.getQuestion(questionId);
    if (!question || !question.task_id) {
      return false;
    }

    return (
      question.blocking_level === 'hard_block' ||
      question.blocking_level === 'soft_block'
    );
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a new AnswerNotificationService instance
 */
export function createAnswerNotificationService(
  storage: ForgeStorage,
  options?: {
    sendRelayMessage?: SendRelayMessageFn;
  }
): AnswerNotificationService {
  return new AnswerNotificationService(storage, options);
}

// ============================================
// Integration Helper
// ============================================

/**
 * Creates a NotifySubscribersFn compatible with QuestionService
 * that uses AnswerNotificationService internally.
 *
 * This bridges the question service's notification callback
 * with the answer notification service.
 */
export function createNotifySubscribersFn(
  service: AnswerNotificationService
): (questionId: string, agentIds: string[], answer: string) => void {
  return (questionId: string, _agentIds: string[], _answer: string): void => {
    // The service will fetch the question and get all agents from there
    service.notifyQuestionAnswered(questionId);
  };
}

import type { ForgeStorage } from '../storage/interface.js';
import type {
  Question,
  QuestionBlockingLevel,
  QuestionStatus,
  CreateQuestionOptions,
} from '../domain/types.js';
import {
  createQuestion,
  calculateQuestionPriorityScore,
  QuestionStatus as QStatus,
} from '../domain/types.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import { TrajectoryEventType } from '../domain/trajectory-events.js';
import type { UserTrajectoryService } from './user-trajectory-service.js';

// ============================================
// Question Service Types
// ============================================

/**
 * Options for creating a question through the service
 */
export interface AskQuestionOptions extends CreateQuestionOptions {
  /** Enable trajectory-aware deduplication check */
  checkTrajectory?: boolean;
  /** Similarity threshold for trajectory matching (0-1, default 0.85) */
  similarityThreshold?: number;
  /** User ID for trajectory lookup (if not provided, trajectory check is skipped) */
  userId?: string;
}

/**
 * Result of asking a question
 */
export interface AskQuestionResult {
  /** The created or matched question */
  question: Question;
  /** Whether this was a new question or subscribed to existing */
  wasSubscribed: boolean;
  /** Whether answer was found in trajectory */
  wasAutoAnswered: boolean;
  /** Source question ID if auto-answered from trajectory */
  sourceQuestionId?: string;
}

/**
 * Result of answering a question
 */
export interface AnswerQuestionResult {
  /** The updated question */
  question: Question;
  /** List of subscriber agent IDs that were notified */
  notifiedSubscribers: string[];
  /** Tasks that were unblocked (if any) */
  unblockedTaskIds: string[];
}

/**
 * Pending question info for API responses
 */
export interface PendingQuestionInfo {
  question_id: string;
  run_id: string;
  task_id?: string;
  agent_id: string;
  text: string;
  options?: string[];
  blocking_level: string;
  steps_blocked: number;
  cascade_depth: number;
  can_use_default: boolean;
  default_value?: string;
  priority_score: number;
  agents_waiting: number;
  created_at: string;
}

/**
 * Callback for notifying subscribers when question is answered
 */
export type NotifySubscribersFn = (questionId: string, agentIds: string[], answer: string) => void;

// ============================================
// Question Service
// ============================================

/**
 * QuestionService handles all question queue operations:
 * - Question creation with deduplication
 * - Subscription to existing questions
 * - Trajectory-aware auto-answering
 * - Priority score management
 * - Answer flow with subscriber notification
 * - Default value timeout handling
 */
export class QuestionService {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture;
  private notifySubscribers?: NotifySubscribersFn;
  private userTrajectoryService?: UserTrajectoryService;

  /** Default timeout for auto-defaulting in milliseconds (5 minutes) */
  private defaultTimeoutMs: number;

  constructor(
    storage: ForgeStorage,
    trajectoryCapture: TrajectoryCapture,
    options?: {
      notifySubscribers?: NotifySubscribersFn;
      defaultTimeoutMs?: number;
      userTrajectoryService?: UserTrajectoryService;
    }
  ) {
    this.storage = storage;
    this.trajectoryCapture = trajectoryCapture;
    this.notifySubscribers = options?.notifySubscribers;
    this.userTrajectoryService = options?.userTrajectoryService;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 5 * 60 * 1000; // 5 minutes
  }

  // ============================================
  // Ask Question (fqq-s4, fqq-s5)
  // ============================================

  /**
   * Creates a new question or subscribes to an existing similar one.
   *
   * Flow:
   * 1. Check trajectory for similar answered questions (if enabled)
   * 2. If found: create auto-answered question with trajectory answer
   * 3. Check for similar pending questions
   * 4. If found: subscribe to existing question
   * 5. Otherwise: create new question
   *
   * @param runId - The run this question belongs to
   * @param agentId - The agent asking the question
   * @param text - The question text
   * @param blockingLevel - How blocking is this question
   * @param options - Additional options
   * @returns Result containing the question and metadata
   */
  askQuestion(
    runId: string,
    agentId: string,
    text: string,
    blockingLevel: QuestionBlockingLevel,
    options?: AskQuestionOptions
  ): AskQuestionResult {
    const checkTrajectory = options?.checkTrajectory ?? true;
    const similarityThreshold = options?.similarityThreshold ?? 0.85;
    const userId = options?.userId;

    // Step 1: Check user trajectory for similar answered questions
    if (checkTrajectory && userId && this.userTrajectoryService) {
      const similarQuestions = this.userTrajectoryService.findSimilarQuestions({
        userId,
        questionText: text,
        threshold: similarityThreshold,
        limit: 1,
      });

      const match = similarQuestions[0];
      if (match) {
        // Create question with auto-answered status
        const question = createQuestion(runId, agentId, text, blockingLevel, {
          ...options,
          status: QStatus.AutoAnsweredFromTrajectory,
          answer: match.event.selected_option,
          answeredBy: 'system',
        });

        this.storage.createQuestion(question);

        // Emit trajectory event
        this.trajectoryCapture.capture(runId, TrajectoryEventType.QuestionAutoAnswered, {
          question_id: question.question_id,
          agent_id: agentId,
          text,
          answer: match.event.selected_option,
          source_question_id: match.event.event_id,
          similarity_score: match.similarity,
        });

        return {
          question,
          wasSubscribed: false,
          wasAutoAnswered: true,
          sourceQuestionId: match.event.event_id,
        };
      }
    }

    // Step 2: Check for similar pending questions
    const pendingQuestions = this.storage.listPendingByPriority(runId);
    const similarPending = this.findSimilarPendingQuestion(
      pendingQuestions,
      text,
      similarityThreshold
    );

    if (similarPending) {
      // Subscribe to existing question
      const updatedQuestion = this.subscribeToQuestion(
        similarPending.question_id,
        agentId
      );

      return {
        question: updatedQuestion,
        wasSubscribed: true,
        wasAutoAnswered: false,
      };
    }

    // Step 3: Create new question
    const question = createQuestion(runId, agentId, text, blockingLevel, options);
    this.storage.createQuestion(question);

    // Emit human input requested event
    this.trajectoryCapture.capture(
      runId,
      TrajectoryEventType.HumanInputRequested,
      {
        question_id: question.question_id,
        agent_id: agentId,
        text,
        blocking_level: blockingLevel,
        options: options?.options,
      },
      options?.taskId
    );

    return {
      question,
      wasSubscribed: false,
      wasAutoAnswered: false,
    };
  }

  // ============================================
  // Subscribe to Question (fqq-s5)
  // ============================================

  /**
   * Subscribes an agent to an existing question.
   *
   * - Adds agent to subscribers array
   * - Recalculates priority score (more subscribers = higher priority)
   * - Emits trajectory event
   *
   * @param questionId - The question to subscribe to
   * @param agentId - The agent subscribing
   * @returns Updated question
   * @throws Error if question not found
   */
  subscribeToQuestion(questionId: string, agentId: string): Question {
    const question = this.storage.getQuestion(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    // Check if already subscribed
    if (question.subscribers.includes(agentId)) {
      return question;
    }

    // Add subscriber
    const newSubscribers = [...question.subscribers, agentId];

    // Recalculate priority score
    const newPriorityScore = calculateQuestionPriorityScore(
      question.blocking_level,
      question.steps_blocked,
      newSubscribers.length,
      question.cascade_depth,
      question.can_use_default
    );

    const updatedQuestion = this.storage.updateQuestion(questionId, {
      subscribers: newSubscribers,
      priority_score: newPriorityScore,
    });

    if (!updatedQuestion) {
      throw new Error(`Failed to update question: ${questionId}`);
    }

    // Emit trajectory event
    this.trajectoryCapture.capture(
      question.run_id,
      TrajectoryEventType.QuestionSubscriberAdded,
      {
        question_id: questionId,
        original_agent_id: question.agent_id,
        subscriber_agent_id: agentId,
        new_subscriber_count: newSubscribers.length,
        new_priority_score: newPriorityScore,
      },
      question.task_id
    );

    return updatedQuestion;
  }

  // ============================================
  // Answer Question (fqq-s6)
  // ============================================

  /**
   * Answers a question and notifies all subscribers.
   *
   * - Updates question status to 'answered'
   * - Records answer and answerer
   * - Notifies all subscribers via callback
   * - Records in trajectory
   *
   * @param questionId - The question to answer
   * @param answer - The answer text
   * @param answeredBy - Who answered (user ID)
   * @returns Result including notified subscribers
   * @throws Error if question not found or already answered
   */
  answerQuestion(
    questionId: string,
    answer: string,
    answeredBy: string
  ): AnswerQuestionResult {
    const question = this.storage.getQuestion(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    if (question.status !== QStatus.Pending) {
      throw new Error(`Question already resolved with status: ${question.status}`);
    }

    // Update question with answer
    const updatedQuestion = this.storage.updateQuestion(questionId, {
      status: QStatus.Answered,
      answer,
      answered_by: answeredBy,
      answered_at: new Date().toISOString(),
    });

    if (!updatedQuestion) {
      throw new Error(`Failed to update question: ${questionId}`);
    }

    // Calculate wait duration
    const waitDurationMs =
      new Date(updatedQuestion.answered_at!).getTime() -
      new Date(updatedQuestion.created_at).getTime();

    // Emit trajectory event
    this.trajectoryCapture.capture(
      question.run_id,
      TrajectoryEventType.QuestionAnswered,
      {
        question_id: questionId,
        agent_id: question.agent_id,
        answer,
        answered_by: answeredBy,
        wait_duration_ms: waitDurationMs,
      },
      question.task_id
    );

    // Record in user trajectory for preference learning
    if (this.userTrajectoryService) {
      try {
        this.userTrajectoryService.recordUserDecision({
          userId: answeredBy,
          scope: 'run',
          questionText: question.text,
          selectedOption: answer,
          runId: question.run_id,
          taskId: question.task_id,
          category: question.blocking_level,
        });
      } catch (err) {
        // Don't let trajectory recording failures block the answer flow
        console.error('[QuestionService] Failed to record user decision:', err);
      }
    }

    // Notify all subscribers (original agent + subscribers)
    const allAgentsToNotify = [question.agent_id, ...question.subscribers];
    const uniqueAgents = [...new Set(allAgentsToNotify)];

    if (this.notifySubscribers) {
      this.notifySubscribers(questionId, uniqueAgents, answer);
    }

    return {
      question: updatedQuestion,
      notifiedSubscribers: uniqueAgents,
      unblockedTaskIds: question.task_id ? [question.task_id] : [],
    };
  }

  // ============================================
  // Dismiss Question
  // ============================================

  /**
   * Dismisses a question without an answer.
   *
   * @param questionId - The question to dismiss
   * @param dismissedBy - Who dismissed it
   * @param reason - Optional reason for dismissal
   * @returns Updated question
   * @throws Error if question not found or already resolved
   */
  dismissQuestion(
    questionId: string,
    dismissedBy: string,
    reason?: string
  ): Question {
    const question = this.storage.getQuestion(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    if (question.status !== QStatus.Pending) {
      throw new Error(`Question already resolved with status: ${question.status}`);
    }

    const updatedQuestion = this.storage.dismissQuestion(questionId);
    if (!updatedQuestion) {
      throw new Error(`Failed to dismiss question: ${questionId}`);
    }

    // Emit trajectory event
    this.trajectoryCapture.capture(
      question.run_id,
      TrajectoryEventType.QuestionDismissed,
      {
        question_id: questionId,
        agent_id: question.agent_id,
        dismissed_by: dismissedBy,
        reason,
      },
      question.task_id
    );

    return updatedQuestion;
  }

  // ============================================
  // Auto-Default Timeout (fqq-s8)
  // ============================================

  /**
   * Processes pending questions that have timed out and should use default values.
   *
   * This should be called periodically by a scheduler.
   *
   * @returns List of questions that were auto-defaulted
   */
  processTimeouts(): Question[] {
    const now = Date.now();
    const autoDefaulted: Question[] = [];

    // Get all pending questions across all runs
    const runs = this.storage.listRuns();

    for (const run of runs) {
      const pendingQuestions = this.storage.listPendingByPriority(run.run_id);

      for (const question of pendingQuestions) {
        // Only process questions that can use default
        if (!question.can_use_default || !question.default_value) {
          continue;
        }

        const createdAt = new Date(question.created_at).getTime();
        const timeoutAt = createdAt + this.defaultTimeoutMs;

        if (now >= timeoutAt) {
          const updated = this.autoDefaultQuestion(question);
          if (updated) {
            autoDefaulted.push(updated);
          }
        }
      }
    }

    return autoDefaulted;
  }

  /**
   * Auto-defaults a single question with its default value.
   */
  private autoDefaultQuestion(question: Question): Question | null {
    const updatedQuestion = this.storage.updateQuestion(question.question_id, {
      status: QStatus.AutoDefaulted,
      answer: question.default_value,
      answered_by: 'system',
      answered_at: new Date().toISOString(),
    });

    if (!updatedQuestion) {
      return null;
    }

    const timeoutSeconds = Math.floor(this.defaultTimeoutMs / 1000);

    // Emit trajectory event
    this.trajectoryCapture.capture(
      question.run_id,
      TrajectoryEventType.QuestionAutoDefaulted,
      {
        question_id: question.question_id,
        agent_id: question.agent_id,
        text: question.text,
        default_value: question.default_value!,
        timeout_seconds: timeoutSeconds,
      },
      question.task_id
    );

    // Notify subscribers
    const allAgentsToNotify = [question.agent_id, ...question.subscribers];
    const uniqueAgents = [...new Set(allAgentsToNotify)];

    if (this.notifySubscribers) {
      this.notifySubscribers(question.question_id, uniqueAgents, question.default_value!);
    }

    return updatedQuestion;
  }

  // ============================================
  // Update Blocked Steps Count
  // ============================================

  /**
   * Updates the steps_blocked count for a question and recalculates priority.
   *
   * @param questionId - The question to update
   * @param stepsBlocked - New count of blocked steps
   * @returns Updated question
   */
  updateStepsBlocked(questionId: string, stepsBlocked: number): Question | null {
    const question = this.storage.getQuestion(questionId);
    if (!question) {
      return null;
    }

    const newPriorityScore = calculateQuestionPriorityScore(
      question.blocking_level,
      stepsBlocked,
      question.subscribers.length,
      question.cascade_depth,
      question.can_use_default
    );

    return this.storage.updateQuestion(questionId, {
      steps_blocked: stepsBlocked,
      priority_score: newPriorityScore,
    });
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Lists pending questions for a run, sorted by priority.
   *
   * @param runId - The run ID
   * @returns List of pending question info
   */
  listPendingQuestions(runId: string): PendingQuestionInfo[] {
    const questions = this.storage.listPendingByPriority(runId);

    return questions.map((q) => ({
      question_id: q.question_id,
      run_id: q.run_id,
      task_id: q.task_id,
      agent_id: q.agent_id,
      text: q.text,
      options: q.options,
      blocking_level: q.blocking_level,
      steps_blocked: q.steps_blocked,
      cascade_depth: q.cascade_depth,
      can_use_default: q.can_use_default,
      default_value: q.default_value,
      priority_score: q.priority_score,
      agents_waiting: 1 + q.subscribers.length, // Original agent + subscribers
      created_at: q.created_at,
    }));
  }

  /**
   * Lists all questions for a run (history), including auto-answered ones.
   *
   * @param runId - The run ID
   * @param status - Optional status filter
   * @returns List of questions
   */
  listQuestionHistory(runId: string, status?: QuestionStatus): Question[] {
    return this.storage.listQuestionsByRun(runId, status);
  }

  /**
   * Gets a question by ID.
   */
  getQuestion(questionId: string): Question | null {
    return this.storage.getQuestion(questionId);
  }

  // ============================================
  // Deduplication Helpers
  // ============================================

  /**
   * Finds a similar pending question to subscribe to.
   *
   * Uses simple Jaccard similarity on words.
   */
  private findSimilarPendingQuestion(
    pendingQuestions: Question[],
    questionText: string,
    threshold: number
  ): Question | null {
    for (const question of pendingQuestions) {
      const similarity = this.calculateTextSimilarity(questionText, question.text);
      if (similarity >= threshold) {
        return question;
      }
    }
    return null;
  }

  /**
   * Calculates text similarity between two strings.
   *
   * Simple implementation using Jaccard similarity on words.
   * Used for pending question deduplication.
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalize = (text: string): Set<string> => {
      return new Set(
        text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((word) => word.length > 2)
      );
    };

    const words1 = normalize(text1);
    const words2 = normalize(text2);

    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a new QuestionService instance.
 */
export function createQuestionService(
  storage: ForgeStorage,
  trajectoryCapture: TrajectoryCapture,
  options?: {
    notifySubscribers?: NotifySubscribersFn;
    defaultTimeoutMs?: number;
    userTrajectoryService?: UserTrajectoryService;
  }
): QuestionService {
  return new QuestionService(storage, trajectoryCapture, options);
}

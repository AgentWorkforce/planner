/**
 * Question domain entity.
 *
 * Represents questions from agents that need human answers.
 * Questions have priority scoring based on blocking level, steps blocked,
 * subscriber count, and time waiting.
 */

/**
 * How severely this question blocks progress.
 */
export type QuestionBlockingLevel =
  | 'hard_block'   // Cannot proceed at all without answer
  | 'soft_block'   // Can use reasonable default but prefers answer
  | 'preference'   // Has good default but wants confirmation
  | 'fyi';         // Informational, no action needed

/**
 * Status of a question.
 */
export type QuestionStatus = 'pending' | 'answered' | 'dismissed';

/**
 * Question entity representing an agent question awaiting human answer.
 */
export interface Question {
  /** Unique question identifier */
  question_id: string;

  /** Plan this question relates to */
  plan_id: string;

  /** Agent that asked the question */
  agent_id: string;

  /** Role of the asking agent (e.g., "architect", "coder") */
  agent_role: string;

  /** The question text */
  text: string;

  /** Additional context for the question */
  context?: string;

  /** Multiple choice options if applicable */
  options?: string[];

  /** How severely this blocks progress */
  blocking_level: QuestionBlockingLevel;

  /** Number of steps currently blocked by this question */
  steps_blocked: number;

  /** Whether agent can use a default if no answer */
  can_use_default: boolean;

  /** Default value agent will use if no answer */
  default_value?: string;

  /** Agent IDs subscribed to this question's answer */
  subscribers: string[];

  /** Question IDs that were merged into this one (deduplication) */
  merged_from: string[];

  /** Current status */
  status: QuestionStatus;

  /** Human's answer if answered */
  answer?: string;

  /** When the question was answered */
  answered_at?: string;

  /** Computed priority score for queue ordering */
  priority_score: number;

  /** When the question was created */
  created_at: string;

  /** When the question was last updated */
  updated_at: string;
}

/**
 * Input for creating a new question.
 */
export interface CreateQuestionInput {
  plan_id: string;
  agent_id: string;
  agent_role: string;
  text: string;
  context?: string;
  options?: string[];
  blocking_level: QuestionBlockingLevel;
  steps_blocked?: number;
  can_use_default?: boolean;
  default_value?: string;
}

/**
 * Filter options for question queries.
 */
export interface QuestionFilter {
  plan_id?: string;
  agent_id?: string;
  status?: QuestionStatus;
}

/**
 * Calculate priority score for a question.
 *
 * Formula: (blocking_level * 100) + (steps_blocked * 10) + (subscribers * 15) + (time_waiting_mins * 2)
 */
export function calculatePriorityScore(
  blockingLevel: QuestionBlockingLevel,
  stepsBlocked: number,
  subscriberCount: number,
  createdAt: string
): number {
  const blockingScores: Record<QuestionBlockingLevel, number> = {
    hard_block: 4,
    soft_block: 3,
    preference: 2,
    fyi: 1,
  };

  const blockingScore = blockingScores[blockingLevel] * 100;
  const stepsScore = stepsBlocked * 10;
  const subscriberScore = subscriberCount * 15;

  // Time waiting in minutes
  const waitingMs = Date.now() - new Date(createdAt).getTime();
  const waitingMins = Math.floor(waitingMs / 60000);
  const timeScore = waitingMins * 2;

  return blockingScore + stepsScore + subscriberScore + timeScore;
}

/**
 * Create a new question with defaults.
 */
export function createQuestion(input: CreateQuestionInput): Question {
  const now = new Date().toISOString();
  const priorityScore = calculatePriorityScore(
    input.blocking_level,
    input.steps_blocked ?? 0,
    0, // No subscribers initially
    now
  );

  return {
    question_id: crypto.randomUUID(),
    plan_id: input.plan_id,
    agent_id: input.agent_id,
    agent_role: input.agent_role,
    text: input.text,
    context: input.context,
    options: input.options,
    blocking_level: input.blocking_level,
    steps_blocked: input.steps_blocked ?? 0,
    can_use_default: input.can_use_default ?? false,
    default_value: input.default_value,
    subscribers: [],
    merged_from: [],
    status: 'pending',
    priority_score: priorityScore,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Check if a question is still pending.
 */
export function isQuestionPending(question: Question): boolean {
  return question.status === 'pending';
}

/**
 * Answer a question.
 */
export function answerQuestion(question: Question, answer: string): Question {
  const now = new Date().toISOString();
  return {
    ...question,
    status: 'answered',
    answer,
    answered_at: now,
    updated_at: now,
  };
}

/**
 * Dismiss a question (use default or skip).
 */
export function dismissQuestion(question: Question): Question {
  return {
    ...question,
    status: 'dismissed',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Subscribe an agent to a question's answer.
 */
export function subscribeToQuestion(question: Question, agentId: string): Question {
  if (question.subscribers.includes(agentId)) {
    return question;
  }

  const newSubscribers = [...question.subscribers, agentId];
  const newPriorityScore = calculatePriorityScore(
    question.blocking_level,
    question.steps_blocked,
    newSubscribers.length,
    question.created_at
  );

  return {
    ...question,
    subscribers: newSubscribers,
    priority_score: newPriorityScore,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Merge a duplicate question into this one.
 */
export function mergeQuestion(question: Question, duplicateId: string, duplicateAgentId: string): Question {
  const newMergedFrom = [...question.merged_from, duplicateId];
  const newSubscribers = question.subscribers.includes(duplicateAgentId)
    ? question.subscribers
    : [...question.subscribers, duplicateAgentId];

  const newPriorityScore = calculatePriorityScore(
    question.blocking_level,
    question.steps_blocked,
    newSubscribers.length,
    question.created_at
  );

  return {
    ...question,
    merged_from: newMergedFrom,
    subscribers: newSubscribers,
    priority_score: newPriorityScore,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update steps blocked count and recalculate priority.
 */
export function updateStepsBlocked(question: Question, stepsBlocked: number): Question {
  const newPriorityScore = calculatePriorityScore(
    question.blocking_level,
    stepsBlocked,
    question.subscribers.length,
    question.created_at
  );

  return {
    ...question,
    steps_blocked: stepsBlocked,
    priority_score: newPriorityScore,
    updated_at: new Date().toISOString(),
  };
}

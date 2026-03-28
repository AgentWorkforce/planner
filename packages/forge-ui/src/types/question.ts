/**
 * Question types for the Forge orchestration UI
 * Questions are asked by agents when they need human input
 */

export enum BlockingLevel {
  HARD_BLOCK = 'hard_block',
  SOFT_BLOCK = 'soft_block',
  PREFERENCE = 'preference',
  FYI = 'fyi',
}

export enum QuestionStatus {
  PENDING = 'pending',
  ANSWERED = 'answered',
  DISMISSED = 'dismissed',
  AUTO_DEFAULTED = 'auto_defaulted',
  AUTO_ANSWERED = 'auto_answered_from_trajectory',
}

export interface Question {
  question_id: string;
  run_id: string;
  task_id: string;
  agent_id: string;

  // Question content
  text: string;
  context?: string;
  options?: string[];

  // Blocking and priority
  blocking_level: BlockingLevel;
  steps_blocked: number;
  cascade_depth: number;
  can_use_default: boolean;
  default_value?: string;
  subscribers: string[];
  priority_score: number;

  // Status and answer
  status: QuestionStatus;
  answer?: string;
  answered_by?: string;

  // Timing
  created_at: string;
  answered_at?: string;

  // UI helpers (populated by API)
  task_title?: string;
  agent_name?: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  is_default?: boolean;
}

export interface QuestionSummary {
  question_id: string;
  agent_id: string;
  text: string;
  blocking_level: BlockingLevel;
  status: QuestionStatus;
  created_at: string;
}

/**
 * Grouped questions with the same text from multiple agents
 */
export interface QuestionGroup {
  text: string;
  questions: Question[];
  combined_priority: number;
  agents_count: number;
}

/**
 * Response from pending questions API
 */
export interface PendingQuestionsResponse {
  questions: Question[];
  total: number;
}

/**
 * Response from question history API
 */
export interface QuestionHistoryResponse {
  questions: Question[];
  total: number;
}

/**
 * Request to answer a question
 */
export interface AnswerQuestionRequest {
  answer: string;
}

/**
 * Request to answer multiple questions at once
 */
export interface AnswerQuestionGroupRequest {
  question_ids: string[];
  answer: string;
}

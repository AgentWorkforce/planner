/**
 * Q&A message payload types for relay channel messaging.
 *
 * Used when broadcasting question answers to plan channels so all agents
 * and UI subscribers can receive real-time Q&A updates.
 */

/** How severely a question is blocking agent progress */
export type QuestionBlockingLevel = 'hard' | 'soft' | 'none';

/**
 * Payload for Q&A channel messages.
 *
 * Sent when a question is answered to notify all channel subscribers
 * (agents and UI) of the answer in real-time.
 */
export interface QAMessagePayload {
  /** Message type discriminator */
  type: 'qa';

  /** Unique question identifier */
  questionId: string;

  /** The question text that was asked */
  questionText: string;

  /** The answer provided by the human */
  answerText: string;

  /** Name of the agent that asked the question */
  agentName: string;

  /** Role of the agent (e.g., "architect", "coder") */
  agentRole: string;

  /** How severely this question was blocking progress */
  blockingLevel: QuestionBlockingLevel;

  /** ISO timestamp when the question was answered */
  answeredAt: string;
}

/**
 * Tier 2 ML classification filter using zero-shot classification
 *
 * Uses Transformers.js to classify signals as actionable feedback vs noise.
 * The model (Xenova/mobilebert-uncased-mnli) performs zero-shot classification
 * across 5 candidate labels to determine signal relevance.
 */

import { getClassifier } from '../ml/model-loader.js';

/**
 * The 5 candidate labels for zero-shot classification
 *
 * These labels are used to classify incoming signals:
 * - product_feedback: User feedback about features, UX, or product experience
 * - bug_report: Bug reports or technical issues
 * - feature_request: Requests for new features or enhancements
 * - question: User questions or support requests
 * - noise: Spam, off-topic, or irrelevant content
 */
const CANDIDATE_LABELS = [
  'product_feedback',
  'bug_report',
  'feature_request',
  'question',
  'noise',
] as const;

/**
 * Type for the category labels
 */
export type Tier2CategoryLabel = typeof CANDIDATE_LABELS[number];

/**
 * Result of Tier 2 ML classification
 */
export interface Tier2Result {
  /** Whether signal passed the filter (not noise AND score >= threshold) */
  passed: boolean;
  /** Top classification score from the model (0-1) */
  feedback_score: number;
  /** The winning label from the classifier */
  category_hint: Tier2CategoryLabel;
}

/**
 * Tier 2 ML classification filter
 *
 * Uses zero-shot classification to determine if a signal is actionable feedback vs noise.
 *
 * The filter:
 * 1. Truncates very long text to avoid model token limits (~512 tokens for mobilebert)
 * 2. Runs zero-shot classification across 5 candidate labels
 * 3. Checks if the top label is NOT 'noise' AND score exceeds threshold
 *
 * @param text - The signal text (title + body concatenated)
 * @param threshold - Minimum score for non-noise labels to pass (default 0.3)
 * @returns Tier2Result with passed/failed, score, and category hint
 * @throws {Error} if ML model is not loaded
 */
export async function tier2Filter(text: string, threshold: number = 0.3): Promise<Tier2Result> {
  const classifier = getClassifier();
  if (!classifier) {
    throw new Error('ML model not loaded. Call loadClassificationModel() first.');
  }

  // Truncate very long text to avoid model token limit issues
  // mobilebert-uncased-mnli has a 512 token limit, ~2000 chars is a safe upper bound
  const truncated = text.length > 2000 ? text.substring(0, 2000) : text;

  // Call the zero-shot classifier
  // The pipeline returns ZeroShotClassificationOutput or ZeroShotClassificationOutput[]
  // When passing a single string, we get a single object
  const rawResult = await classifier(truncated, CANDIDATE_LABELS as unknown as string[]);

  // Handle both single result and array (we always pass a single string, so expect single object)
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;

  // Extract top label and score
  const topLabel = result.labels[0] as Tier2CategoryLabel;
  const topScore = result.scores[0] as number;

  // Signal passes if:
  // 1. Top label is NOT 'noise'
  // 2. Top score exceeds threshold
  const passed = topLabel !== 'noise' && topScore >= threshold;

  return {
    passed,
    feedback_score: topScore,
    category_hint: topLabel,
  };
}

/**
 * Satisfaction Scorer — heuristic-based scoring of step output against acceptance criteria.
 *
 * Scores 0-100 based on keyword overlap between step output and acceptance criterion descriptions.
 * Fast, free, no API calls. Designed as a first-pass signal; LLM-as-judge can be layered on later.
 */

// Common English stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this', 'it',
  'its', 'my', 'your', 'his', 'her', 'our', 'their', 'what', 'which',
  'who', 'whom', 'these', 'those', 'am', 'about', 'up', 'down',
]);

interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

export interface ScoringResult {
  /** Overall satisfaction score 0-100 */
  score: number;
  /** Human-readable explanation of the score */
  reasoning: string;
  /** Criteria descriptions that were matched in the output */
  matched_criteria: string[];
  /** Criteria descriptions that were NOT matched in the output */
  failed_criteria: string[];
}

/**
 * Extract meaningful keywords from text, excluding stop words.
 * Returns lowercase tokens of 3+ chars.
 */
function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Check if output text matches a criterion by keyword overlap.
 * Returns true if at least 40% of criterion keywords appear in the output.
 */
function criterionMatches(criterionKeywords: Set<string>, outputKeywords: Set<string>): boolean {
  if (criterionKeywords.size === 0) return true; // empty criterion = trivially matched
  let matchCount = 0;
  for (const keyword of criterionKeywords) {
    if (outputKeywords.has(keyword)) matchCount++;
  }
  const matchRatio = matchCount / criterionKeywords.size;
  return matchRatio >= 0.4; // 40% keyword overlap threshold
}

/**
 * Score step output against acceptance criteria.
 *
 * @param output - The agent's output text from step completion
 * @param acceptanceCriteria - The step's acceptance criteria to score against
 * @returns ScoringResult with 0-100 score, reasoning, and matched/failed lists
 */
export function scoreStepOutput(
  output: string,
  acceptanceCriteria: AcceptanceCriterion[],
): ScoringResult {
  // No criteria = neutral score (can't judge)
  if (acceptanceCriteria.length === 0) {
    return {
      score: 50,
      reasoning: 'No acceptance criteria defined — score is neutral',
      matched_criteria: [],
      failed_criteria: [],
    };
  }

  // No output = zero score
  if (!output || output.trim().length === 0) {
    return {
      score: 0,
      reasoning: 'No output produced by agent',
      matched_criteria: [],
      failed_criteria: acceptanceCriteria.map(c => c.description),
    };
  }

  const outputKeywords = extractKeywords(output);
  const matched: string[] = [];
  const failed: string[] = [];

  for (const criterion of acceptanceCriteria) {
    const criterionKeywords = extractKeywords(criterion.description);
    if (criterionMatches(criterionKeywords, outputKeywords)) {
      matched.push(criterion.description);
    } else {
      failed.push(criterion.description);
    }
  }

  const score = Math.round((matched.length / acceptanceCriteria.length) * 100);

  // Build reasoning
  const parts: string[] = [];
  parts.push(`${matched.length}/${acceptanceCriteria.length} criteria matched`);
  if (failed.length > 0) {
    parts.push(`Missing: ${failed.slice(0, 3).join('; ')}${failed.length > 3 ? ` (+${failed.length - 3} more)` : ''}`);
  }

  return {
    score,
    reasoning: parts.join('. '),
    matched_criteria: matched,
    failed_criteria: failed,
  };
}

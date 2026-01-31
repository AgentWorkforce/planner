/**
 * User Trajectory Module
 *
 * Stores question-answer pairs to allow agents to query past decisions
 * before asking duplicate questions. This is an in-memory store for MVP.
 *
 * Future enhancement: Persist to SQLite for durability across restarts.
 */

/** Entry in the user trajectory representing a question-answer pair */
export interface TrajectoryEntry {
  /** Unique identifier for the question */
  questionId: string;
  /** The question text that was asked */
  questionText: string;
  /** The user's answer to the question */
  answer: string;
  /** Priority level of the question */
  priority: 'blocking' | 'preference' | 'confirmation';
  /** When the question was answered */
  timestamp: string;
  /** ID of the agent that asked the question */
  agentId: string;
}

/**
 * User trajectory map: planId -> array of trajectory entries
 * Organized by plan so each plan has its own decision history.
 */
export type UserTrajectory = Map<string, TrajectoryEntry[]>;

/**
 * In-memory trajectory storage.
 * Key: planId (or 'global' for cross-plan decisions)
 * Value: Array of trajectory entries in chronological order
 */
const trajectoryStore: UserTrajectory = new Map();

/**
 * Add a question-answer pair to the trajectory for a specific plan.
 *
 * @param planId - The plan ID this decision belongs to
 * @param entry - The trajectory entry (timestamp will be added automatically)
 *
 * @example
 * ```typescript
 * addToTrajectory('plan-abc123', {
 *   questionId: 'q-1234567890-xyz',
 *   questionText: 'Should we add OAuth2?',
 *   answer: 'Yes, use Auth0',
 *   priority: 'blocking',
 *   agentId: 'planner-lead-123'
 * });
 * ```
 */
export function addToTrajectory(
  planId: string,
  entry: Omit<TrajectoryEntry, 'timestamp'>
): void {
  const fullEntry: TrajectoryEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const existing = trajectoryStore.get(planId);
  if (existing) {
    existing.push(fullEntry);
  } else {
    trajectoryStore.set(planId, [fullEntry]);
  }

  console.log(`[user-trajectory] Added entry to ${planId}: ${entry.questionId}`);
}

/**
 * Get all trajectory entries for a specific plan.
 * Returns entries in chronological order (oldest first).
 *
 * @param planId - The plan ID to query
 * @returns Array of trajectory entries, or empty array if none exist
 *
 * @example
 * ```typescript
 * const history = getTrajectory('plan-abc123');
 * history.forEach(entry => {
 *   console.log(`Q: ${entry.questionText}`);
 *   console.log(`A: ${entry.answer}`);
 * });
 * ```
 */
export function getTrajectory(planId: string): TrajectoryEntry[] {
  return trajectoryStore.get(planId) || [];
}

/**
 * Normalize question text for comparison.
 * Removes punctuation, converts to lowercase, and trims whitespace.
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:'"]/g, '') // Remove common punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Find a trajectory entry with similar question text.
 * Uses simple substring matching for MVP (can be enhanced with semantic similarity).
 *
 * Matching strategy:
 * 1. Normalize both questions (lowercase, trim, remove punctuation)
 * 2. Check if either question contains the other as substring
 * 3. Return the most recent match if multiple matches exist
 *
 * @param planId - The plan ID to search within
 * @param questionText - The question text to search for
 * @returns The matching trajectory entry, or undefined if none found
 *
 * @example
 * ```typescript
 * const similar = findSimilarQuestion('plan-abc123', 'Should we use OAuth?');
 * if (similar) {
 *   console.log(`Already answered: ${similar.answer}`);
 * }
 * ```
 */
export function findSimilarQuestion(
  planId: string,
  questionText: string
): TrajectoryEntry | undefined {
  const entries = getTrajectory(planId);
  if (entries.length === 0) {
    return undefined;
  }

  const normalizedQuery = normalizeForMatching(questionText);

  // Find all matching entries
  const matches = entries.filter((entry) => {
    const normalizedEntry = normalizeForMatching(entry.questionText);

    // Check if either question contains the other
    return (
      normalizedEntry.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedEntry)
    );
  });

  // Return the most recent match (entries are in chronological order)
  return matches[matches.length - 1];
}

/**
 * Clear all trajectory entries for a specific plan.
 * Useful for cleanup or testing.
 *
 * @param planId - The plan ID to clear
 *
 * @example
 * ```typescript
 * clearTrajectory('plan-abc123');
 * ```
 */
export function clearTrajectory(planId: string): void {
  trajectoryStore.delete(planId);
  console.log(`[user-trajectory] Cleared trajectory for ${planId}`);
}

/**
 * Get all plan IDs that have trajectory entries.
 * Useful for debugging and administrative purposes.
 *
 * @returns Array of plan IDs with stored trajectories
 *
 * @example
 * ```typescript
 * const planIds = getAllTrajectoryPlanIds();
 * console.log(`Tracking ${planIds.length} plans`);
 * ```
 */
export function getAllTrajectoryPlanIds(): string[] {
  return Array.from(trajectoryStore.keys());
}

/**
 * Get total number of trajectory entries across all plans.
 * Useful for monitoring and debugging.
 *
 * @returns Total count of trajectory entries
 *
 * @example
 * ```typescript
 * const total = getTotalTrajectoryEntries();
 * console.log(`Total Q&A pairs: ${total}`);
 * ```
 */
export function getTotalTrajectoryEntries(): number {
  let total = 0;
  for (const entries of trajectoryStore.values()) {
    total += entries.length;
  }
  return total;
}

/**
 * Confidence extraction utilities for processing specialist observations
 */

/**
 * Parse confidence value from various formats
 * @param value - Unknown value that might represent confidence
 * @returns Numeric confidence score (0-100)
 */
export function parseConfidenceValue(value: unknown): number {
  // Handle undefined/null
  if (value === undefined || value === null) {
    return 0;
  }

  // Handle numeric values
  if (typeof value === 'number') {
    return Math.min(100, Math.max(0, value));
  }

  // Handle string values
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();

    // Percentage format: '75%'
    if (trimmed.endsWith('%')) {
      const num = parseFloat(trimmed.slice(0, -1));
      return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
    }

    // Verbal confidence levels
    const verbalLevels: Record<string, number> = {
      confident: 80,
      forming: 50,
      exploring: 20,
      uncertain: 10,
      unknown: 0,
    };

    if (trimmed in verbalLevels) {
      return verbalLevels[trimmed] ?? 0;
    }

    // Try direct number parse
    const num = parseFloat(trimmed);
    return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
  }

  return 0;
}

/**
 * Extract confidence from specialist observations
 * @param observations - Specialist observation object
 * @returns Overall confidence and per-category breakdown
 */
export function extractSpecialistConfidence(
  observations: Record<string, unknown>
): { overall: number; byCategory: Record<string, number> } {
  // Check for root-level 'confidence_level' first
  if ('confidence_level' in observations) {
    const overall = parseConfidenceValue(observations.confidence_level);
    return {
      overall,
      byCategory: {},
    };
  }

  // Fall back to per-category confidence values
  const byCategory: Record<string, number> = {};
  let totalConfidence = 0;
  let categoryCount = 0;

  for (const [key, value] of Object.entries(observations)) {
    // Skip meta fields like 'role', 'roleHint', etc.
    if (key === 'role' || key === 'roleHint' || key === 'name') {
      continue;
    }

    // Check if category object has a 'confidence' field
    if (
      value &&
      typeof value === 'object' &&
      'confidence' in value &&
      value.confidence !== undefined
    ) {
      const categoryConfidence = parseConfidenceValue(
        (value as Record<string, unknown>).confidence
      );
      byCategory[key] = categoryConfidence;
      totalConfidence += categoryConfidence;
      categoryCount++;
    } else if (typeof value === 'object' && value !== null) {
      // Category exists but no explicit confidence - default to 50%
      byCategory[key] = 50;
      totalConfidence += 50;
      categoryCount++;
    }
  }

  const overall = categoryCount > 0 ? totalConfidence / categoryCount : 0;

  return {
    overall,
    byCategory,
  };
}

/**
 * Aggregate confidence across all specialists in a session
 * @param understanding - Session understanding object (specialist -> observations)
 * @returns Session-wide confidence score and per-specialist breakdown
 */
export function aggregateSessionConfidence(
  understanding: Record<string, Record<string, unknown>>
): { score: number; bySpecialist: Record<string, number> } {
  const bySpecialist: Record<string, number> = {};
  let totalWeightedConfidence = 0;
  let totalWeight = 0;

  for (const [specialistName, observations] of Object.entries(understanding)) {
    const { overall, byCategory } = extractSpecialistConfidence(observations);

    // Weight is the number of categories (empty specialists have weight 0)
    const categoryCount = Object.keys(byCategory).length;
    const weight = categoryCount > 0 ? categoryCount : overall > 0 ? 1 : 0;

    if (weight > 0) {
      bySpecialist[specialistName] = overall;
      totalWeightedConfidence += overall * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? totalWeightedConfidence / totalWeight : 0;

  return {
    score,
    bySpecialist,
  };
}

/**
 * Individual scoring factor calculators
 * Each function returns a score between 0 and 1
 */

/**
 * Calculate recency score using exponential time decay
 * Fresh signals score higher, with half-life of ~7 days
 *
 * @param signalTimestamp When the signal occurred
 * @param now Current time (defaults to Date.now())
 * @returns Score 0-1, where 1 is very recent
 */
export function calcRecency(signalTimestamp: Date, now: Date = new Date()): number {
  const hoursElapsed = (now.getTime() - signalTimestamp.getTime()) / (1000 * 60 * 60);
  const halfLifeHours = 7 * 24; // 7 days
  const lambda = Math.log(2) / halfLifeHours;

  const score = Math.exp(-lambda * hoursElapsed);
  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}

/**
 * Calculate specificity score (direct passthrough from extraction)
 *
 * @param extractionSpecificity Specificity value from extraction result (0-1)
 * @returns Score 0-1
 */
export function calcSpecificity(extractionSpecificity: number): number {
  return Math.max(0, Math.min(1, extractionSpecificity));
}

/**
 * Calculate source authority score based on source tier
 * Maps tier classification to authority score
 *
 * @param sourceTier Source tier identifier (tier1, tier2, tier3, etc.)
 * @returns Score 0-1, where tier1=1.0, tier2=0.7, tier3=0.4, unknown=0.2
 */
export function calcSourceAuthority(sourceTier?: string): number {
  if (!sourceTier) return 0.2;

  const normalized = sourceTier.toLowerCase();
  if (normalized === 'tier1' || normalized === '1') return 1.0;
  if (normalized === 'tier2' || normalized === '2') return 0.7;
  if (normalized === 'tier3' || normalized === '3') return 0.4;

  return 0.2; // Unknown tier
}

/**
 * Calculate repetition score with diminishing returns
 * Uses log-based scaling, capping at ~10 signals
 *
 * @param clusterSignalCount Number of signals in the cluster
 * @returns Score 0-1, with logarithmic scaling
 */
export function calcRepetition(clusterSignalCount: number): number {
  if (clusterSignalCount <= 0) return 0;

  const maxSignals = 10;
  const score = Math.log2(clusterSignalCount + 1) / Math.log2(maxSignals + 1);
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate emotional intensity score (direct passthrough from extraction)
 *
 * @param extractionEmotionalIntensity Emotional intensity from extraction result (0-1)
 * @returns Score 0-1
 */
export function calcEmotionalIntensity(extractionEmotionalIntensity: number): number {
  return Math.max(0, Math.min(1, extractionEmotionalIntensity));
}

/**
 * Calculate strategic fit score using keyword overlap
 * Uses Jaccard similarity (intersection/union) between signal and greenhouse keywords
 *
 * @param signalKeywords Keywords extracted from the signal
 * @param greenhouseKeywords Focus keywords defined for the greenhouse
 * @returns Score 0-1, where 0=no overlap, 1=perfect match
 */
export function calcStrategicFit(
  signalKeywords: string[],
  greenhouseKeywords: string[]
): number {
  if (greenhouseKeywords.length === 0) return 0.5; // Neutral if no greenhouse keywords defined

  const signalSet = new Set(signalKeywords.map((k) => k.toLowerCase()));
  const greenhouseSet = new Set(greenhouseKeywords.map((k) => k.toLowerCase()));

  // Calculate intersection size
  let intersectionSize = 0;
  signalSet.forEach((k) => {
    if (greenhouseSet.has(k)) {
      intersectionSize++;
    }
  });

  // Calculate union size (signal + greenhouse - intersection)
  const unionSize = signalSet.size + greenhouseSet.size - intersectionSize;

  if (unionSize === 0) return 0;

  const jaccard = intersectionSize / unionSize;
  return Math.max(0, Math.min(1, jaccard));
}

/**
 * Calculate actionability score (direct passthrough from extraction)
 *
 * @param extractionActionability Actionability value from extraction result (0-1)
 * @returns Score 0-1
 */
export function calcActionability(extractionActionability: number): number {
  return Math.max(0, Math.min(1, extractionActionability));
}

/**
 * Calculate content quality score based on heuristics
 * Considers title length, body length, and structural elements
 *
 * @param title Signal title
 * @param body Signal body text
 * @returns Score 0-1, where higher indicates better quality
 */
export function calcContentQuality(title: string, body: string): number {
  let score = 0;
  let maxScore = 3; // 3 components

  // Title length scoring (optimal: 10-100 chars)
  const titleLen = title.trim().length;
  if (titleLen >= 10 && titleLen <= 100) {
    score += 1;
  } else if (titleLen > 0 && titleLen < 10) {
    score += 0.5; // Too short
  } else if (titleLen > 100 && titleLen <= 150) {
    score += 0.7; // Slightly too long
  }

  // Body length scoring (optimal: 100-5000 chars)
  const bodyLen = body.trim().length;
  if (bodyLen >= 100 && bodyLen <= 5000) {
    score += 1;
  } else if (bodyLen > 50 && bodyLen < 100) {
    score += 0.6; // Too short
  } else if (bodyLen > 5000 && bodyLen <= 10000) {
    score += 0.8; // Slightly too long
  } else if (bodyLen < 50) {
    score += 0.3; // Very short
  } else if (bodyLen > 10000) {
    score += 0.5; // Very long
  }

  // Structural elements (lists, paragraphs, formatting indicators)
  const hasStructure =
    /\n\n/.test(body) || // Multiple paragraphs
    /^[\s]*[-*•]/.test(body) || // Bullet points
    /\d+\./.test(body) || // Numbered lists
    /```/.test(body); // Code blocks

  if (hasStructure) {
    score += 1;
  } else {
    score += 0.3; // Some credit for any body
  }

  const normalized = score / maxScore;
  return Math.max(0, Math.min(1, normalized));
}

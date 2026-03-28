/**
 * ComplexityEstimator - Task Complexity Estimation
 *
 * Estimates task complexity based on available step/task metadata to inform model routing.
 * Uses simple heuristics to classify tasks into complexity levels that map to model choices.
 *
 * Complexity levels:
 * - trivial (0.0-0.2): Single-file changes, documentation, simple analysis
 * - simple (0.2-0.4): Few dependencies, straightforward implementation
 * - moderate (0.4-0.6): Multiple dependencies, moderate acceptance criteria
 * - complex (0.6-0.8): Many dependencies, complex criteria, cross-cutting concerns
 * - architecture (0.8-1.0): Architectural changes, system design, multi-package refactors
 */

import type { Task, AcceptanceCriterion } from '../domain/types.js';

// ============================================
// Types
// ============================================

export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'architecture';

export interface ComplexityEstimate {
  /** Complexity level (maps to model routing rules) */
  level: ComplexityLevel;
  /** Numeric score (0-1) */
  score: number;
  /** Explanation of factors contributing to complexity */
  factors: string[];
}

// ============================================
// Keyword Detection
// ============================================

const ARCHITECTURE_KEYWORDS = [
  'architect',
  'design',
  'refactor',
  'redesign',
  'restructure',
  'migrate',
  'system',
  'infrastructure',
  'platform',
];

const SIMPLE_KEYWORDS = [
  'analyze',
  'review',
  'document',
  'read',
  'verify',
  'check',
  'investigate',
  'explore',
];

const COMPLEX_KEYWORDS = [
  'integrate',
  'orchestrat',
  'coordinat',
  'multi-',
  'cross-cutting',
  'end-to-end',
  'full-stack',
];

/**
 * Checks if text contains any keywords from a list (case-insensitive, partial match).
 */
function containsKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

// ============================================
// Complexity Estimation
// ============================================

/**
 * Estimates task complexity based on available metadata.
 *
 * Heuristics:
 * - Architecture keywords in title/description → architecture (0.9)
 * - Many acceptance criteria (4+) → complex (0.7)
 * - Many dependencies (3+) → complex (0.7)
 * - Simple keywords + few criteria → simple (0.3)
 * - Long description (>500 chars) → moderate-complex (0.5-0.7)
 *
 * @param task - The task to estimate complexity for
 * @returns Complexity estimate with level, score, and factors
 */
export function estimateTaskComplexity(task: Task): ComplexityEstimate {
  const factors: string[] = [];
  let score = 0.4; // Default to simple-moderate

  // Extract text for keyword analysis
  const titleText = task.step_title || '';
  const descText = task.step_description || '';
  const roleText = task.owner_role || '';
  const combinedText = `${titleText} ${descText} ${roleText}`;

  // Factor 1: Architecture keywords (strongest signal)
  if (containsKeyword(combinedText, ARCHITECTURE_KEYWORDS)) {
    score = Math.max(score, 0.85);
    factors.push('Architecture-related keywords detected');
  }

  // Factor 2: Acceptance criteria count
  const acCount = task.acceptance_criteria?.length ?? 0;
  if (acCount === 0) {
    // No criteria might mean trivial OR under-specified
    // Check if there are simple keywords to confirm trivial
    if (containsKeyword(combinedText, SIMPLE_KEYWORDS)) {
      score = Math.min(score, 0.25);
      factors.push('No acceptance criteria + analysis/review keywords');
    }
  } else if (acCount === 1) {
    factors.push('Single acceptance criterion');
  } else if (acCount >= 2 && acCount <= 3) {
    score = Math.max(score, 0.5);
    factors.push(`${acCount} acceptance criteria (moderate)`);
  } else if (acCount >= 4) {
    score = Math.max(score, 0.7);
    factors.push(`${acCount} acceptance criteria (complex)`);
  }

  // Factor 3: Dependency count
  const depCount = task.dependencies?.length ?? 0;
  if (depCount === 0) {
    factors.push('No dependencies (independent task)');
    // Slightly reduce complexity if truly independent
    if (score > 0.4) {
      score -= 0.05;
    }
  } else if (depCount >= 1 && depCount <= 2) {
    factors.push(`${depCount} dependencies`);
  } else if (depCount >= 3) {
    score = Math.max(score, 0.65);
    factors.push(`${depCount} dependencies (high coupling)`);
  }

  // Factor 4: Description length (signal of complexity)
  const descLength = descText.length;
  if (descLength > 500) {
    score = Math.max(score, 0.6);
    factors.push('Long description (>500 chars)');
  } else if (descLength > 200) {
    factors.push('Moderate description length');
  } else if (descLength < 50) {
    // Very short description might indicate trivial task
    if (containsKeyword(combinedText, SIMPLE_KEYWORDS)) {
      score = Math.min(score, 0.3);
      factors.push('Short description + simple keywords');
    }
  }

  // Factor 5: Simple keyword detection (reduce complexity)
  if (containsKeyword(combinedText, SIMPLE_KEYWORDS) && score > 0.4) {
    score -= 0.1;
    factors.push('Simple/analysis keywords detected');
  }

  // Factor 6: Complex keyword detection (increase complexity)
  if (containsKeyword(combinedText, COMPLEX_KEYWORDS)) {
    score = Math.max(score, 0.65);
    factors.push('Complex/integration keywords detected');
  }

  // Factor 7: Specification complexity (if present)
  if (task.specification && Object.keys(task.specification).length > 5) {
    score = Math.max(score, 0.6);
    factors.push('Detailed specification provided');
  }

  // Clamp score to [0, 1]
  score = Math.max(0, Math.min(1, score));

  // Map score to level
  const level = scoreToLevel(score);

  return {
    level,
    score,
    factors,
  };
}

/**
 * Maps a numeric complexity score to a complexity level.
 */
function scoreToLevel(score: number): ComplexityLevel {
  if (score <= 0.2) return 'trivial';
  if (score <= 0.4) return 'simple';
  if (score <= 0.6) return 'moderate';
  if (score <= 0.8) return 'complex';
  return 'architecture';
}

/**
 * Helper to get just the complexity level string (for backward compatibility).
 */
export function estimateComplexityLevel(task: Task): ComplexityLevel {
  return estimateTaskComplexity(task).level;
}

/**
 * Helper to get just the complexity score (0-1).
 */
export function estimateComplexityScore(task: Task): number {
  return estimateTaskComplexity(task).score;
}

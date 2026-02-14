/**
 * Scoring module exports
 */

// Main scoring function
export { scoreSignal } from './score.js';
export type { ScoringContext, ScoringResult } from './score.js';

// Weight resolution
export { DEFAULT_WEIGHTS, resolveWeights } from './weights.js';
export type { WeightOptions } from './weights.js';

// Individual factor calculators (exported for testing and custom scoring)
export {
  calcRecency,
  calcSpecificity,
  calcSourceAuthority,
  calcRepetition,
  calcEmotionalIntensity,
  calcStrategicFit,
  calcActionability,
  calcContentQuality,
} from './factors.js';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Specialist confidence levels
 */
export type ConfidenceLevel = 'exploring' | 'forming' | 'confident';

/**
 * Specialist perspective structure
 */
export interface SpecialistPerspective {
  take: string;
  concerns: string[];
  confidence: ConfidenceLevel;
}

/**
 * Props for OverallConfidenceBar component
 */
export interface OverallConfidenceBarProps {
  specialists?: Record<string, SpecialistPerspective>;
  className?: string;
}

/**
 * Calculate overall confidence from specialist perspectives
 * Returns a percentage (0-100)
 *
 * Maps confidence levels to numeric values:
 * - exploring = 33
 * - forming = 66
 * - confident = 100
 */
function calculateOverallConfidence(
  specialists?: Record<string, SpecialistPerspective>,
): number {
  if (!specialists || Object.keys(specialists).length === 0) {
    return 0;
  }

  const confidenceValues: Record<ConfidenceLevel, number> = {
    exploring: 33,
    forming: 66,
    confident: 100,
  };

  const values = Object.values(specialists).map(
    (p) => confidenceValues[p.confidence],
  );
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.round(average);
}

/**
 * OverallConfidenceBar
 *
 * Aggregate confidence bar showing overall understanding level across specialists.
 *
 * Features:
 * - Shows aggregate confidence from specialist perspectives
 * - Color-coded: orange (exploring) → purple (forming) → green (confident)
 * - Percentage display with label
 * - Smooth transitions
 *
 * Color mapping:
 * - < 40%: Orange (exploring)
 * - 40-69%: Purple (forming)
 * - >= 70%: Green (confident)
 *
 * Usage:
 * ```tsx
 * <OverallConfidenceBar
 *   specialists={{
 *     architect: {
 *       take: 'REST API fits well with CRUD operations',
 *       concerns: ['Scaling concerns'],
 *       confidence: 'forming',
 *     },
 *     designer: {
 *       take: 'Simple form flow works for MVP',
 *       concerns: [],
 *       confidence: 'confident',
 *     },
 *   }}
 * />
 * ```
 */
export function OverallConfidenceBar({
  specialists,
  className,
}: OverallConfidenceBarProps) {
  const confidence = useMemo(
    () => calculateOverallConfidence(specialists),
    [specialists],
  );

  // Determine color based on confidence level
  const getColor = (conf: number) => {
    if (conf < 40) return 'bg-accent-orange'; // exploring
    if (conf < 70) return 'bg-accent-purple'; // forming
    return 'bg-accent-green'; // confident
  };

  // Get label based on confidence level
  const getLabel = (conf: number) => {
    if (conf < 40) return 'Exploring';
    if (conf < 70) return 'Forming';
    return 'Confident';
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="w-full h-2 bg-bg-hover rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            getColor(confidence),
          )}
          style={{ width: `${confidence}%` }}
          role="progressbar"
          aria-valuenow={confidence}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall confidence: ${confidence}%`}
        />
      </div>

      {/* Percentage label and status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{getLabel(confidence)}</span>
        <span className="text-xs font-medium text-text-primary">
          {confidence}%
        </span>
      </div>
    </div>
  );
}

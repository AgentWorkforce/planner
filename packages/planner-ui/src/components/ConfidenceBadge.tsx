import type { Confidence } from '@/types';

interface ConfidenceBadgeProps {
  confidence: Confidence;
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Get human-readable label for confidence level.
 */
function getConfidenceLabel(confidence: Confidence): string {
  switch (confidence) {
    case 'exploring':
      return 'Exploring';
    case 'forming':
      return 'Forming';
    case 'confident':
      return 'Confident';
  }
}

/**
 * Get Tailwind classes for badge background and text based on confidence level.
 */
function getConfidenceClasses(confidence: Confidence): string {
  switch (confidence) {
    case 'exploring':
      // Purple - early stage, gathering information
      return 'bg-accent-purple/10 text-accent-purple';
    case 'forming':
      // Cyan - making connections, patterns emerging
      return 'bg-accent-cyan/10 text-accent-cyan';
    case 'confident':
      // Green - solid understanding
      return 'bg-success/10 text-success';
  }
}

/**
 * Get the confidence indicator icon.
 * Uses simple shapes to indicate progress: ○ → ◐ → ●
 */
function ConfidenceIcon({ confidence }: { confidence: Confidence }) {
  const baseClasses = 'w-3 h-3 rounded-full border-2 border-current';

  switch (confidence) {
    case 'exploring':
      // Empty circle
      return <span className={baseClasses} />;
    case 'forming':
      // Half-filled circle (using gradient)
      return (
        <span className={`${baseClasses} relative overflow-hidden`}>
          <span className="absolute inset-0 bg-current" style={{ clipPath: 'inset(0 50% 0 0)' }} />
        </span>
      );
    case 'confident':
      // Filled circle
      return <span className={`${baseClasses} bg-current`} />;
  }
}

/**
 * Badge component displaying a confidence level with icon and optional label.
 *
 * Confidence indicates how certain an agent is about their observations:
 * - exploring: Early stage, gathering information
 * - forming: Making connections, patterns emerging
 * - confident: Solid understanding reached
 *
 * - compact: icon only (small circle indicator)
 * - full: icon + human-readable label
 */
export function ConfidenceBadge({
  confidence,
  variant = 'full',
  className = '',
}: ConfidenceBadgeProps) {
  const label = getConfidenceLabel(confidence);
  const colorClasses = getConfidenceClasses(confidence);

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center justify-center p-1 rounded ${colorClasses} ${className}`}
        title={label}
      >
        <ConfidenceIcon confidence={confidence} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${colorClasses} ${className}`}
    >
      <ConfidenceIcon confidence={confidence} />
      <span>{label}</span>
    </span>
  );
}

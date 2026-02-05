/**
 * Block visibility utility functions
 *
 * Determines how blocks appear based on confidence thresholds,
 * implementing progressive disclosure UX.
 */

/**
 * Visibility levels based on confidence
 */
export type VisibilityLevel = 'forming' | 'emerging' | 'developing' | 'ready';

/**
 * Get visibility level from confidence percentage
 *
 * Thresholds:
 * - 0-30%: forming (tiny dot)
 * - 30-60%: emerging (shows emoji)
 * - 60-90%: developing (full content)
 * - 90-100%: ready (glow effect)
 *
 * @param confidence - Confidence percentage (0-100)
 * @returns Visibility level
 */
export function getVisibilityLevel(confidence: number): VisibilityLevel {
  if (confidence < 30) return 'forming';
  if (confidence < 60) return 'emerging';
  if (confidence < 90) return 'developing';
  return 'ready';
}

/**
 * Calculate block size from confidence and content length
 *
 * Size is primarily driven by content amount (mini-spec detail),
 * with confidence as a modifier. More content = larger block.
 *
 * Base size by content:
 * - Short (<100 chars): 40-60px base
 * - Medium (100-300 chars): 60-80px base
 * - Long (300-600 chars): 80-100px base
 * - Very long (600+ chars): 100-120px base
 *
 * Confidence modifier:
 * - forming (0-30%): 0.5x multiplier (tiny)
 * - emerging (30-60%): 0.7x multiplier
 * - developing (60-90%): 1.0x multiplier
 * - ready (90-100%): 1.1x multiplier
 *
 * @param confidence - Confidence percentage (0-100)
 * @param contentLength - Length of block content (optional)
 * @returns Size in pixels
 */
export function getBlockSize(confidence: number, contentLength: number = 0): number {
  // Base size from content length
  let baseSize: number;
  if (contentLength < 100) {
    baseSize = 40 + (contentLength / 100) * 20; // 40-60px
  } else if (contentLength < 300) {
    baseSize = 60 + ((contentLength - 100) / 200) * 20; // 60-80px
  } else if (contentLength < 600) {
    baseSize = 80 + ((contentLength - 300) / 300) * 20; // 80-100px
  } else {
    baseSize = 100 + Math.min((contentLength - 600) / 400 * 20, 20); // 100-120px max
  }

  // Confidence multiplier
  let multiplier: number;
  if (confidence < 30) {
    multiplier = 0.5;
  } else if (confidence < 60) {
    multiplier = 0.7;
  } else if (confidence < 90) {
    multiplier = 1.0;
  } else {
    multiplier = 1.1;
  }

  // Special case: forming blocks stay small regardless of content
  if (confidence < 30) {
    return 20;
  }

  return Math.round(baseSize * multiplier);
}

/**
 * Determine if block should be interactive
 *
 * Only blocks with 30%+ confidence are clickable.
 *
 * @param confidence - Confidence percentage (0-100)
 * @returns True if block should be interactive
 */
export function isBlockInteractive(confidence: number): boolean {
  return confidence >= 30;
}

/**
 * Determine if keyword should be shown
 *
 * Shows keyword only when confidence is high enough (60%+)
 * and size is large enough to display it properly.
 *
 * @param confidence - Confidence percentage (0-100)
 * @param size - Block size in pixels
 * @returns True if keyword should be displayed
 */
export function shouldShowKeyword(confidence: number, size: number): boolean {
  return confidence >= 60 && size >= 60;
}

/**
 * Determine if block should show glow effect
 *
 * Glow/pulse effect for blocks that are ready for curation (90%+).
 *
 * @param confidence - Confidence percentage (0-100)
 * @returns True if glow effect should be applied
 */
export function shouldShowGlow(confidence: number): boolean {
  return confidence >= 90;
}

/**
 * Calculate opacity from confidence
 *
 * Minimum 30% opacity, scales up to 100% with confidence.
 *
 * @param confidence - Confidence percentage (0-100)
 * @returns Opacity value (0-1)
 */
export function getBlockOpacity(confidence: number): number {
  return Math.max(0.3, Math.min(1, confidence / 100));
}

/**
 * Get border radius based on visibility level
 *
 * @param level - Visibility level
 * @returns CSS border-radius value
 */
export function getBorderRadius(level: VisibilityLevel): string {
  if (level === 'forming') return '9999px'; // rounded-full
  if (level === 'ready') return '0.75rem'; // rounded-xl
  return '1rem'; // rounded-2xl
}

/**
 * Calculate border styling from confidence
 *
 * Border transitions from yellow (low confidence) to green (high confidence).
 *
 * @param confidence - Confidence percentage (0-100)
 * @returns Border styling properties
 */
export function getBorderStyle(confidence: number): {
  width: number;
  hue: number;
  opacity: number;
} {
  const confidenceRatio = Math.max(0, Math.min(1, (confidence - 50) / 50));

  return {
    width: Math.max(1, Math.round(1 + confidenceRatio * 2)),
    hue: 60 + confidenceRatio * 60, // Yellow (60) → Green (120)
    opacity: 0.1 + confidenceRatio * 0.9,
  };
}

/**
 * Determine emoji size class based on block size
 *
 * @param size - Block size in pixels
 * @returns Tailwind text size class
 */
export function getEmojiSizeClass(size: number): string {
  if (size < 40) return 'text-lg';
  if (size < 60) return 'text-2xl';
  return 'text-3xl';
}

/**
 * Get box shadow for block
 *
 * @param shouldGlow - Whether block should glow
 * @param borderHue - HSL hue value for glow color
 * @returns CSS box-shadow value
 */
export function getBoxShadow(shouldGlow: boolean, borderHue: number): string {
  if (shouldGlow) {
    return `0 0 20px hsl(${borderHue} 70% 50% / 0.5)`;
  }
  return '0 2px 8px rgba(0, 0, 0, 0.08)';
}

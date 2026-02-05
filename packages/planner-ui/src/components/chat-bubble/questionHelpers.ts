import type { Question } from '@/types/plan';

/**
 * Get blocking level badge styling.
 */
export function getBlockingBadge(blockingLevel: Question['blocking_level']): {
  text: string;
  className: string;
} {
  switch (blockingLevel) {
    case 'hard_block':
      return {
        text: 'BLOCKING',
        className: 'bg-error text-white',
      };
    case 'soft_block':
      return {
        text: 'SOFT BLOCK',
        className: 'bg-warning/20 text-warning',
      };
    case 'preference':
      return {
        text: 'PREFERENCE',
        className: 'bg-warning/20 text-warning',
      };
    case 'fyi':
      return {
        text: 'FYI',
        className: 'bg-accent-cyan/20 text-accent-cyan',
      };
    default:
      return {
        text: blockingLevel,
        className: 'bg-bg-elevated text-text-muted',
      };
  }
}

/**
 * Format seconds to mm:ss display.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

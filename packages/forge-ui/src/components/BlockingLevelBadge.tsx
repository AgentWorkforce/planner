/**
 * BlockingLevelBadge - Badge displaying the blocking level of a question
 *
 * - BLOCKING (red): For hard_block - task cannot proceed
 * - PREFERENCE (orange/amber): For soft_block - can proceed with default
 * - FYI (cyan): For fyi and preference - informational
 */

import { cn } from '@/lib/utils';
import { BlockingLevel } from '@/types';

interface BlockingLevelBadgeProps {
  level: BlockingLevel;
  className?: string;
}

const badgeConfig: Record<BlockingLevel, { label: string; classes: string }> = {
  [BlockingLevel.HARD_BLOCK]: {
    label: 'BLOCKING',
    classes: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  [BlockingLevel.SOFT_BLOCK]: {
    label: 'PREFERENCE',
    classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  [BlockingLevel.PREFERENCE]: {
    label: 'FYI',
    classes: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
  [BlockingLevel.FYI]: {
    label: 'FYI',
    classes: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
};

export function BlockingLevelBadge({ level, className }: BlockingLevelBadgeProps) {
  const config = badgeConfig[level] || badgeConfig[BlockingLevel.FYI];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Compact version for tighter spaces
 */
export function BlockingLevelBadgeCompact({ level, className }: BlockingLevelBadgeProps) {
  const config = badgeConfig[level] || badgeConfig[BlockingLevel.FYI];

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

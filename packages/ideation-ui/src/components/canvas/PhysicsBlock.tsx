import { cn } from '@/lib/utils';
import { PhysicsBlockBase } from '@/components/shared/PhysicsBlockBase';
import {
  getVisibilityLevel,
  isBlockInteractive,
  shouldShowKeyword,
  shouldShowGlow,
  getBlockOpacity,
  getBorderRadius,
  getBorderStyle,
  getEmojiSizeClass,
  getBoxShadow,
} from './utils/blockVisibility';

/**
 * Block status progression:
 * forming (0-30%) → emerging (30-60%) → developing (60-90%) → ready (90-100%) → curated
 */
export type BlockStatus = 'forming' | 'emerging' | 'developing' | 'ready' | 'curated';

/**
 * Props for PhysicsBlock component
 */
export interface PhysicsBlockProps {
  block: {
    id: string;
    emoji: string;
    keyword: string;
    confidence: number;
    status: BlockStatus;
    userEdited?: boolean;
  };
  position: { x: number; y: number };
  angle?: number; // Rotation angle from physics engine (in radians)
  size: number; // Derived from confidence/status
  onClick?: () => void;
}

/**
 * PhysicsBlock
 *
 * Canvas block component that renders ideas/concepts as physics-enabled blocks.
 * Uses PhysicsBlockBase for position/rotation sync and adds canvas-specific styling.
 *
 * Features:
 * - Size/opacity scales with confidence (0-100%)
 * - Status-based rendering (forming → emerging → developing → ready → curated)
 * - Draggable via physics engine MouseConstraint
 * - GPU-accelerated transforms for smooth movement
 *
 * Size/Content by Status:
 * - forming (0-30%): 20px tiny dot, no content
 * - emerging (30-60%): 40-60px, shows emoji
 * - developing (60-90%): 60-80px, shows emoji + keyword
 * - ready (90-100%): 80-100px, adds glow/pulse effect
 * - curated: full size with special styling
 *
 * Usage:
 * ```tsx
 * <PhysicsBlock
 *   block={{
 *     id: 'block-1',
 *     emoji: '💡',
 *     keyword: 'Idea',
 *     confidence: 75,
 *     status: 'developing',
 *   }}
 *   position={{ x: 100, y: 100 }}
 *   angle={0.1}
 *   size={60}
 *   onClick={() => console.log('Block clicked')}
 * />
 * ```
 */
export function PhysicsBlock({
  block,
  position,
  angle = 0,
  size,
  onClick,
}: PhysicsBlockProps) {
  // Determine visibility level and interactivity
  const visibilityLevel = getVisibilityLevel(block.confidence);
  const interactive = isBlockInteractive(block.confidence);

  // Calculate visual properties using utility functions
  const showKeyword = shouldShowKeyword(block.confidence, size);
  const showGlow = shouldShowGlow(block.confidence);
  const opacity = getBlockOpacity(block.confidence);

  // Border styling based on confidence (yellow → green gradient)
  const borderStyle = getBorderStyle(block.confidence);
  const borderRadius = getBorderRadius(visibilityLevel);
  const emojiSizeClass = getEmojiSizeClass(size);
  const boxShadow = getBoxShadow(showGlow, borderStyle.hue);

  return (
    <PhysicsBlockBase
      id={block.id}
      position={position}
      angle={angle}
      size={size}
      activityScore={block.confidence}
      onClick={interactive ? onClick : undefined}
      className={cn(
        'flex flex-col items-center justify-center',
        interactive ? 'cursor-pointer hover:shadow-lg' : 'cursor-default pointer-events-none',
        showGlow && 'animate-pulse',
      )}
      style={{
        opacity,
        backgroundColor: 'var(--block-draft)',
        borderRadius,
        borderStyle: 'solid',
        borderWidth: `${borderStyle.width}px`,
        borderColor: `hsl(${borderStyle.hue} 70% 45% / ${borderStyle.opacity})`,
        boxShadow,
      }}
    >
      {/* User Edited Indicator - shown in top-right corner */}
      {block.userEdited && visibilityLevel !== 'forming' && (
        <div
          className="absolute top-0 right-0 w-2 h-2 rounded-full"
          style={{
            backgroundColor: 'var(--color-accent-cyan)',
            boxShadow: '0 0 4px rgba(0, 217, 255, 0.4)',
          }}
          title="User edited"
        />
      )}

      {/* Emoji - shown for emerging and above */}
      {visibilityLevel !== 'forming' && (
        <span className={cn('transition-all duration-200', emojiSizeClass)}>{block.emoji}</span>
      )}

      {/* Keyword - shown for developing and above when size permits */}
      {showKeyword && (
        <span className="text-[10px] text-[#7a7a7a] mt-0.5 truncate max-w-full px-1 uppercase tracking-wide">
          {block.keyword}
        </span>
      )}

      {/* Tiny dot indicator for forming blocks */}
      {visibilityLevel === 'forming' && (
        <div
          className="rounded-full bg-[#7a7a7a]"
          style={{
            width: Math.max(4, size / 5),
            height: Math.max(4, size / 5),
          }}
        />
      )}
    </PhysicsBlockBase>
  );
}

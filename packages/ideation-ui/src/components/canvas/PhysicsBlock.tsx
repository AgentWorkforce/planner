import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
  size: number; // Derived from confidence/status
  onClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * PhysicsBlock
 *
 * Individual block component that renders as an absolutely positioned HTML div
 * synced with a physics body. Shows emoji + keyword based on status/confidence.
 *
 * Features:
 * - Position synced via requestAnimationFrame
 * - Size/opacity scales with confidence (0-100%)
 * - Draggable interaction (mouse down/up events)
 * - Status-based rendering (forming → emerging → developing → ready → curated)
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
 *   size={60}
 *   onClick={() => console.log('Block clicked')}
 *   onDragStart={() => console.log('Drag started')}
 *   onDragEnd={() => console.log('Drag ended')}
 * />
 * ```
 */
export function PhysicsBlock({
  block,
  position,
  size,
  onClick,
  onDragStart,
  onDragEnd,
}: PhysicsBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // Sync DOM position with physics body position
  useEffect(() => {
    const element = blockRef.current;
    if (!element) return;

    // Use requestAnimationFrame for smooth updates
    const updatePosition = () => {
      if (element) {
        // Center the element on the physics body position
        const left = position.x - size / 2;
        const top = position.y - size / 2;

        // Use transform for GPU-accelerated positioning
        element.style.transform = `translate(${left}px, ${top}px)`;
      }
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [position.x, position.y, size]);

  // Determine visibility level and interactivity
  const visibilityLevel = getVisibilityLevel(block.confidence);
  const interactive = isBlockInteractive(block.confidence);

  // Handle drag start (only for interactive blocks)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive) return;
      e.preventDefault();
      setIsDragging(true);
      onDragStart?.();
    },
    [onDragStart, interactive],
  );

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd?.();
    }
  }, [isDragging, onDragEnd]);

  // Global mouse up listener (in case mouse leaves element while dragging)
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  // Calculate visual properties using utility functions
  const showKeyword = shouldShowKeyword(block.confidence, size);
  const showGlow = shouldShowGlow(block.confidence);
  const opacity = getBlockOpacity(block.confidence);
  const scale = isDragging ? 1.05 : 1;

  // Border styling based on confidence (yellow → green gradient)
  const borderStyle = getBorderStyle(block.confidence);
  const borderRadius = getBorderRadius(visibilityLevel);
  const emojiSizeClass = getEmojiSizeClass(size);
  const boxShadow = getBoxShadow(showGlow, borderStyle.hue);

  return (
    <div
      ref={blockRef}
      onMouseDown={handleMouseDown}
      onClick={interactive ? onClick : undefined}
      className={cn(
        'absolute select-none',
        'flex flex-col items-center justify-center',
        'transition-all duration-200',
        interactive ? 'cursor-pointer hover:shadow-lg' : 'cursor-default pointer-events-none',
        showGlow && 'animate-pulse',
      )}
      style={{
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale})`,
        willChange: 'transform',
        backgroundColor: 'var(--mockup-block-draft)',
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
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { PhysicsBlock, type BlockStatus } from './PhysicsBlock';
import { getBlockSize } from './utils/blockVisibility';
import { cn } from '@/lib/utils';

/**
 * Block interface matching PhysicsBlock requirements
 */
export interface Block {
  id: string;
  type: string;
  title: string;
  emoji: string;
  keyword: string;
  content: string;
  specialist: string;
  sourceContext: string;
  confidence: number;
  status: BlockStatus;
  createdAt: string;
  curatedAt?: string | null;
  userEdited?: boolean;
  userEditedFields?: string[];
}

/**
 * Props for FormingBlocksColumn component
 */
export interface FormingBlocksColumnProps {
  blocks: Block[];
  onBlockClick?: (blockId: string) => void;
  onBlockDragEnd?: (blockId: string) => void;
  className?: string;
}


/**
 * FormingBlocksColumn
 *
 * Left column container that hosts the physics simulation for non-curated blocks.
 * Blocks float and drift toward the center with collision detection.
 *
 * Features:
 * - Desktop: Physics simulation using matter.js via usePhysicsEngine hook
 * - Mobile: Simple vertical list (performance optimization)
 * - Renders PhysicsBlock components for each non-curated block
 * - Auto-syncs physics bodies with block array changes
 * - Block size calculated from confidence level
 * - Smooth animations within container bounds
 *
 * Block Lifecycle:
 * 1. Block appears as tiny dot (forming, 0-30%)
 * 2. Grows to show emoji (emerging, 30-60%)
 * 3. Shows keyword (developing, 60-90%)
 * 4. Ready for curation (ready, 90-100%)
 * 5. Moved to curated column (status = 'curated')
 *
 * Physics Behavior (Desktop):
 * - Central attraction force pulls blocks toward center
 * - Collision detection prevents overlap
 * - Wall boundaries at container edges
 * - Zero gravity (no falling)
 *
 * Mobile Behavior:
 * - No physics simulation (performance)
 * - Simple list layout with touch-friendly spacing
 *
 * @example
 * ```tsx
 * <FormingBlocksColumn
 *   blocks={allBlocks}
 *   onBlockClick={(id) => console.log('Clicked', id)}
 *   onBlockDragEnd={(id) => console.log('Dragged', id)}
 * />
 * ```
 */
export function FormingBlocksColumn({
  blocks,
  onBlockClick,
  onBlockDragEnd,
  className,
}: FormingBlocksColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Only initialize physics on desktop
  const physicsResult = usePhysicsEngine(isMobile ? { current: null } : containerRef);
  const { addBody, removeBody, bodies, isReady } = physicsResult;

  // Filter for non-curated blocks only
  const filteredBlocks = blocks.filter((block) => block.status !== 'curated');

  // Sync physics bodies with block array (desktop only)
  useEffect(() => {
    if (isMobile || !isReady) return;

    const currentIds = new Set(filteredBlocks.map((b) => b.id));
    const physicsIds = new Set(bodies.keys());

    // Add new bodies for blocks that don't have physics bodies yet
    filteredBlocks.forEach((block) => {
      if (!physicsIds.has(block.id)) {
        const contentLength = block.content?.length || 0;
        const size = getBlockSize(block.confidence, contentLength);
        addBody({
          id: block.id,
          radius: size / 2,
        });
      }
    });

    // Remove physics bodies for blocks that no longer exist
    physicsIds.forEach((id) => {
      if (!currentIds.has(id)) {
        removeBody(id);
      }
    });
  }, [isMobile, filteredBlocks, addBody, removeBody, bodies, isReady]);

  // Mobile: Simple list layout
  if (isMobile) {
    return (
      <div
        className={cn('w-full overflow-y-auto bg-[var(--mockup-bg-primary)] p-3', className)}
      >
        <div className="space-y-3">
          {filteredBlocks.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">
              No forming blocks yet
            </div>
          ) : (
            filteredBlocks.map((block) => {
              const contentLength = block.content?.length || 0;
              const size = getBlockSize(block.confidence, contentLength);

              return (
                <div
                  key={block.id}
                  className="relative"
                  style={{ minHeight: `${size + 16}px` }}
                >
                  <PhysicsBlock
                    block={block}
                    position={{ x: size / 2 + 8, y: size / 2 + 8 }}
                    size={size}
                    onClick={() => onBlockClick?.(block.id)}
                    onDragEnd={() => onBlockDragEnd?.(block.id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Desktop: Physics simulation
  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full overflow-hidden bg-[var(--mockup-bg-primary)]', className)}
    >
      {filteredBlocks.map((block) => {
        const position = bodies.get(block.id) || { x: 0, y: 0, angle: 0, radius: 0 };
        const contentLength = block.content?.length || 0;
        const size = getBlockSize(block.confidence, contentLength);

        return (
          <PhysicsBlock
            key={block.id}
            block={block}
            position={{ x: position.x, y: position.y }}
            size={size}
            onClick={() => onBlockClick?.(block.id)}
            onDragEnd={() => onBlockDragEnd?.(block.id)}
          />
        );
      })}
    </div>
  );
}

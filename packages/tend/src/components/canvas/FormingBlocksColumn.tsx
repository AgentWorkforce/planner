import { useEffect, useRef, useState } from 'react';
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
 * />
 * ```
 */
export function FormingBlocksColumn({
  blocks,
  onBlockClick,
  className,
}: FormingBlocksColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);

  // Only initialize physics on desktop
  const physicsResult = usePhysicsEngine(isMobile ? { current: null } : containerRef);
  const { addBody, removeBody, bodies, isReady } = physicsResult;

  // Filter for non-curated blocks only
  const filteredBlocks = blocks.filter((block) => block.status !== 'curated');

  // Cap visible blocks for physics simulation
  const MAX_VISIBLE = 5;
  const overflowCount = filteredBlocks.length - MAX_VISIBLE;
  const visibleBlocks = showAll ? filteredBlocks : filteredBlocks.slice(0, MAX_VISIBLE);

  // Sync physics bodies with block array (desktop only)
  useEffect(() => {
    if (isMobile || !isReady) return;

    const currentIds = new Set(visibleBlocks.map((b) => b.id));
    const physicsIds = new Set(bodies.keys());

    // Add new bodies for blocks that don't have physics bodies yet
    visibleBlocks.forEach((block) => {
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
  }, [isMobile, visibleBlocks, addBody, removeBody, bodies, isReady]);

  const header = (
    <div className="flex-shrink-0 flex items-center px-4 h-9 border-b border-border-subtle bg-[var(--color-bg-chrome)]">
      <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
        Forming ({overflowCount > 0 && !showAll ? `${MAX_VISIBLE} of ${filteredBlocks.length}` : filteredBlocks.length})
      </h2>
    </div>
  );

  // Mobile: Simple list layout
  if (isMobile) {
    return (
      <div
        className={cn('w-full h-full flex flex-col overflow-hidden bg-[var(--canvas-bg)]', className)}
      >
        {header}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {filteredBlocks.length === 0 ? (
              <div className="text-center text-[var(--canvas-text-muted)] text-sm py-8">
                No forming blocks yet
              </div>
            ) : (
              <>
                {visibleBlocks.map((block) => {
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
                      />
                    </div>
                  );
                })}
                {overflowCount > 0 && (
                  <>
                    {showAll && (
                      <div className="space-y-1">
                        {filteredBlocks.slice(MAX_VISIBLE).map((block) => (
                          <button
                            key={block.id}
                            onClick={() => onBlockClick?.(block.id)}
                            className="w-full text-left px-3 py-2 text-sm rounded-lg bg-[var(--canvas-bg-secondary)] hover:bg-[var(--canvas-bg-tertiary)] transition-colors truncate"
                          >
                            <span className="mr-1.5">{block.emoji || '💭'}</span>
                            {block.keyword || block.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowAll((prev) => !prev)}
                      className="mx-auto mt-2 px-3 py-1.5 text-xs text-[var(--canvas-text-muted)] hover:text-[var(--canvas-text-secondary)] bg-[var(--canvas-bg-tertiary)]/50 hover:bg-[var(--canvas-bg-tertiary)] rounded-full transition-colors block"
                    >
                      {showAll ? 'Show fewer' : `+${overflowCount} more`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Physics simulation
  return (
    <div className={cn('h-full flex flex-col overflow-hidden bg-[var(--canvas-bg)]', className)}>
      {header}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden"
        >
          {visibleBlocks.map((block) => {
            const position = bodies.get(block.id) || { x: 0, y: 0, angle: 0, radius: 0 };
            const contentLength = block.content?.length || 0;
            const size = getBlockSize(block.confidence, contentLength);

            return (
              <PhysicsBlock
                key={block.id}
                block={block}
                position={{ x: position.x, y: position.y }}
                angle={position.angle}
                size={size}
                onClick={() => onBlockClick?.(block.id)}
              />
            );
          })}
        </div>
        {overflowCount > 0 && (
          <div className="px-2 pb-2">
            {showAll && (
              <div className="mt-2 space-y-1 px-2 max-h-32 overflow-y-auto">
                {filteredBlocks.slice(MAX_VISIBLE).map((block) => (
                  <button
                    key={block.id}
                    onClick={() => onBlockClick?.(block.id)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg bg-[var(--canvas-bg-secondary)] hover:bg-[var(--canvas-bg-tertiary)] transition-colors truncate"
                  >
                    <span className="mr-1.5">{block.emoji || '💭'}</span>
                    {block.keyword || block.title}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="mx-auto mt-2 px-3 py-1.5 text-xs text-[var(--canvas-text-muted)] hover:text-[var(--canvas-text-secondary)] bg-[var(--canvas-bg-tertiary)]/50 hover:bg-[var(--canvas-bg-tertiary)] rounded-full transition-colors block"
            >
              {showAll ? 'Show fewer' : `+${overflowCount} more`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

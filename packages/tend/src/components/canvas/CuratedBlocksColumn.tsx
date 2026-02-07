import { cn } from '@/lib/utils';
import { type Block } from './FormingBlocksColumn';

/**
 * Props for CuratedBlocksColumn component
 */
export interface CuratedBlocksColumnProps {
  blocks: Block[]; // All blocks (will be filtered for curated status)
  onBlockClick?: (blockId: string) => void;
  onUncurate?: (blockId: string) => void; // Move block back to physics
  className?: string;
}

/**
 * Props for individual curated block card
 */
interface CuratedBlockCardProps {
  block: Block;
  onClick?: () => void;
  onUncurate?: () => void;
}

/**
 * CuratedBlockCard
 *
 * Individual card for a curated block with green accent border.
 *
 * Features:
 * - Green left border using --block-curated-border
 * - Background color using --block-curated
 * - Displays emoji, title (from keyword), and keyword
 * - Hover effect for interactivity
 * - Optional uncurate button to move back to forming
 *
 * @example
 * ```tsx
 * <CuratedBlockCard
 *   block={block}
 *   onClick={() => handleClick(block.id)}
 *   onUncurate={() => handleUncurate(block.id)}
 * />
 * ```
 */
function CuratedBlockCard({ block, onClick, onUncurate }: CuratedBlockCardProps) {
  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg cursor-pointer transition-all shadow-md hover:shadow-lg animate-in slide-in-from-left-2 fade-in duration-300"
      style={{
        backgroundColor: 'var(--block-curated)',
        borderLeft: '3px solid var(--block-curated-border)',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl" role="img" aria-label={block.keyword}>
          {block.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{block.keyword}</div>
          <div className="text-xs text-muted-foreground truncate">
            {Math.round(block.confidence)}% confidence
          </div>
        </div>
        {onUncurate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUncurate();
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Move back to forming"
            aria-label="Uncurate block"
          >
            ↩
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * CuratedBlocksColumn
 *
 * Right column showing a vertical stack of curated blocks.
 * Displays blocks that have been promoted from the physics simulation
 * to a stable, organized state.
 *
 * Features:
 * - Filters blocks to show only curated status
 * - Green accent border on each card (--block-curated-border)
 * - Click handler for block selection
 * - Optional uncurate action to move blocks back to physics
 * - Empty state with helpful message
 * - Scrollable when content overflows
 *
 * Visual Design:
 * - Compact card layout with emoji + keyword
 * - Green left border indicates curated status
 * - Count badge shows total curated blocks
 * - Hover effects for interactivity
 *
 * @example
 * ```tsx
 * <CuratedBlocksColumn
 *   blocks={allBlocks}
 *   onBlockClick={(id) => handleSelect(id)}
 *   onUncurate={(id) => handleMoveToForming(id)}
 * />
 * ```
 */
export function CuratedBlocksColumn({
  blocks,
  onBlockClick,
  onUncurate,
  className,
}: CuratedBlocksColumnProps) {
  // Filter for curated blocks only
  const curatedBlocks = blocks.filter((b) => b.status === 'curated');

  // Empty state when no blocks are curated yet
  if (curatedBlocks.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full p-4 text-center',
          className
        )}
      >
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No curated blocks yet</p>
          <p className="text-sm mt-2">
            Click on forming blocks to curate them when ready
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 p-3 overflow-y-auto', className)}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--canvas-text-muted)] mb-2">
        Curated ({curatedBlocks.length})
      </h3>
      {curatedBlocks.map((block) => (
        <CuratedBlockCard
          key={block.id}
          block={block}
          onClick={() => onBlockClick?.(block.id)}
          onUncurate={onUncurate ? () => onUncurate(block.id) : undefined}
        />
      ))}
    </div>
  );
}

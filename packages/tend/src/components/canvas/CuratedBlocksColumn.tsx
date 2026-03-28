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
 * Props for individual curated block row
 */
interface CuratedBlockRowProps {
  block: Block;
  isLast: boolean;
  onClick?: () => void;
  onUncurate?: () => void;
}

/**
 * CuratedBlockRow — single row in an ASCII tree list.
 * Uses box-drawing characters for structure, dot leaders for alignment.
 */
function CuratedBlockRow({ block, isLast, onClick, onUncurate }: CuratedBlockRowProps) {
  const branch = isLast ? '└' : '├';
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1.5 cursor-pointer py-0 hover:text-foreground transition-colors font-mono text-sm animate-in slide-in-from-left-2 fade-in duration-300"
      style={{ color: 'var(--canvas-text-secondary, var(--color-text-secondary))' }}
    >
      <span className="text-[var(--canvas-text-muted)] select-none opacity-40">{branch}─</span>
      <span className="text-base leading-none w-5 text-center inline-flex justify-center shrink-0 grayscale" role="img" aria-label={block.keyword}>
        {block.emoji}
      </span>
      <span className="font-medium truncate">{block.keyword}</span>
      <span className="flex-1 min-w-0 overflow-hidden text-[var(--canvas-text-muted)] select-none opacity-40 leading-none">
        {'·'.repeat(40)}
      </span>
      <span className="text-xs whitespace-nowrap tabular-nums">
        {Math.round(block.confidence)}%
      </span>
      {onUncurate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUncurate();
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          title="Move back to forming"
          aria-label="Uncurate block"
        >
          ↩
        </button>
      )}
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
    <div className={cn('flex flex-col p-3 overflow-y-auto', className)}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--canvas-text-muted)] mb-2 font-mono">
        Curated ({curatedBlocks.length})
      </h3>
      {curatedBlocks.map((block, i) => (
        <CuratedBlockRow
          key={block.id}
          block={block}
          isLast={i === curatedBlocks.length - 1}
          onClick={() => onBlockClick?.(block.id)}
          onUncurate={onUncurate ? () => onUncurate(block.id) : undefined}
        />
      ))}
    </div>
  );
}

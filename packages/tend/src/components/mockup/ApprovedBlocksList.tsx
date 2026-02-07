import type { Block } from '@/lib/mockup/block-utils';
import { ApprovedBlockCard } from './ApprovedBlockCard';

interface ApprovedBlocksListProps {
  blocks: Block[];
  onBlockClick: (block: Block) => void;
}

export function ApprovedBlocksList({ blocks, onBlockClick }: ApprovedBlocksListProps) {
  return (
    <div className="w-[25%] flex-shrink-0 flex flex-col rounded-3xl px-5 pb-5 pt-0">
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">Curated Blocks</p>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">{blocks.length}</div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {blocks.map((block) => (
          <ApprovedBlockCard key={block.id} block={block} onClick={() => onBlockClick(block)} />
        ))}
      </div>
    </div>
  );
}

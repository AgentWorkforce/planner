import type { Block } from '@/lib/mockup/block-utils';

interface ApprovedBlockCardProps {
  block: Block;
  onClick: () => void;
}

export function ApprovedBlockCard({ block, onClick }: ApprovedBlockCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[var(--mockup-block-draft)] rounded-lg border border-[#4a7c59]/30 px-3 py-2.5 text-left shadow-md hover:border-[#4a7c59] hover:shadow-lg transition-all group"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{block.emoji}</span>
        <span className="text-sm text-[#2d2d2d] font-medium truncate">{block.title}</span>
      </div>
    </button>
  );
}

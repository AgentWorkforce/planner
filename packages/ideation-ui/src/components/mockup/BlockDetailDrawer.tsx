import ReactMarkdown from 'react-markdown';
import type { Block } from '@/lib/mockup/block-utils';
import { cn } from '@/lib/utils';
import { CloseIcon } from '@/components/icons';

interface BlockDetailDrawerProps {
  block: Block | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
}

export function BlockDetailDrawer({ block, open, onClose, onApprove }: BlockDetailDrawerProps) {
  const isDraft = block?.status === 'draft';

  return (
    <>
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 w-[400px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col',
          'transform transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0dbd3]">
          <div className="flex items-center gap-2">
            {block && <span className="text-2xl">{block.emoji}</span>}
            <div>
              <p className="text-sm font-semibold text-[#7a7a7a] uppercase tracking-wide">Block</p>
              <h2 className="text-lg font-semibold text-[#2d2d2d]">{block?.title ?? 'Select a block'}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-[#f5f0e8] transition-colors" aria-label="Close drawer">
            <CloseIcon className="text-[#7a7a7a]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm text-[#2d2d2d] leading-relaxed space-y-4">
          {block ? <ReactMarkdown>{block.content}</ReactMarkdown> : <p className="text-[#9a9a9a]">Select a block to see the mini-spec.</p>}
        </div>
        {isDraft && block && (
          <div className="px-4 py-3 border-t border-[#e0dbd3] bg-white">
            <button
              type="button"
              onClick={() => onApprove(block.id)}
              className="w-full bg-[#4a7c59] text-white rounded-lg py-2.5 font-medium hover:bg-[#3d6549] transition-colors"
            >
              Approve
            </button>
          </div>
        )}
      </div>
      {open && <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40" onClick={onClose} />}
    </>
  );
}

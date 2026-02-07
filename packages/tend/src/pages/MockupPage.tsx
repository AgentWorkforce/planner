import { useEffect, useMemo, useState } from 'react';
import { DraftBlocksCanvas } from '@/components/mockup/DraftBlocksCanvas';
import { MinimalChat } from '@/components/mockup/MinimalChat';
import { ApprovedBlocksList } from '@/components/mockup/ApprovedBlocksList';
import { BlockDetailDrawer } from '@/components/mockup/BlockDetailDrawer';
import { useMockData } from '@/hooks/mockup/useMockData';
import type { Block } from '@/lib/mockup/block-utils';
import '@/components/mockup/mockup-theme.css';

export function MockupPage() {
  const { blocks, draftBlocks, approvedBlocks, messages, approveBlock, addBlock, addMessage } = useMockData();
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  const currentSelectedBlock = useMemo(() => {
    if (!selectedBlock) return null;
    return blocks.find((block) => block.id === selectedBlock.id) ?? selectedBlock;
  }, [blocks, selectedBlock]);

  useEffect(() => {
    if (!drawerOpen) return;
    const updated = blocks.find((block) => block.id === selectedBlock?.id);
    if (updated && updated !== selectedBlock) {
      setSelectedBlock(updated);
    }
  }, [blocks, drawerOpen, selectedBlock]);

  const handleBlockClick = (block: Block) => {
    setSelectedBlock(block);
    setDrawerOpen(true);
  };

  const handleApprove = (id: string) => {
    setDrawerOpen(false);
    setTimeout(() => {
      setPendingApprovalId(id);
    }, 320);
  };

  const handleApproveAnimationComplete = (id: string) => {
    approveBlock(id);
    setPendingApprovalId(null);
  };

  return (
    <div className="mockup-root h-screen w-full p-6 flex gap-6" style={{ background: 'var(--mockup-bg)' }}>
      <DraftBlocksCanvas
        blocks={draftBlocks}
        onBlockClick={handleBlockClick}
        onAddBlock={addBlock}
        pendingApprovalId={pendingApprovalId}
        onApproveAnimationComplete={handleApproveAnimationComplete}
      />

      <div className="flex-1 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">Brainstorming session</h1>
        </div>
        <MinimalChat messages={messages} onSendMessage={addMessage} />
      </div>

      <ApprovedBlocksList blocks={approvedBlocks} onBlockClick={handleBlockClick} />

      <BlockDetailDrawer
        block={currentSelectedBlock}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApprove={handleApprove}
      />
    </div>
  );
}

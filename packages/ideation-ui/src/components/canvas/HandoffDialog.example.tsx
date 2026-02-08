import { useState } from 'react';
import { HandoffDialog, type HandoffOptions } from './HandoffDialog';
import type { Block } from './FormingBlocksColumn';

/**
 * Example usage of HandoffDialog component
 *
 * Shows the dialog for managing un-curated blocks before handoff to Planner.
 */
export default function HandoffDialogExample() {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to create example blocks
  const createBlock = (partial: Pick<Block, 'id' | 'emoji' | 'keyword' | 'confidence' | 'status'>): Block => ({
    ...partial,
    type: 'feature',
    title: `Example ${partial.keyword}`,
    content: `Description of ${partial.keyword.toLowerCase()} block.`,
    specialist: 'problem-finder',
    sourceContext: 'example',
    createdAt: new Date().toISOString(),
    curatedAt: partial.status === 'curated' ? new Date().toISOString() : null,
  });

  // Sample blocks for demo
  const blocks: Block[] = [
    createBlock({ id: '1', emoji: '🎯', keyword: 'Goals', confidence: 95, status: 'curated' }),
    createBlock({ id: '2', emoji: '📊', keyword: 'Analytics', confidence: 92, status: 'curated' }),
    createBlock({ id: '3', emoji: '🔧', keyword: 'Tools', confidence: 88, status: 'curated' }),
    createBlock({ id: '4', emoji: '🤔', keyword: 'Questions', confidence: 75, status: 'ready' }),
    createBlock({ id: '5', emoji: '💡', keyword: 'Ideas', confidence: 65, status: 'developing' }),
    createBlock({ id: '6', emoji: '📝', keyword: 'Notes', confidence: 45, status: 'emerging' }),
  ];

  const handleHandoff = (options: HandoffOptions) => {
    console.log('Handoff initiated with options:', options);

    // In real implementation:
    // - Filter blocks based on options.uncuratedAction and options.threshold
    // - Send to Planner API
    // - Update session status
    // - Navigate to plan view

    setIsOpen(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">HandoffDialog Example</h1>
      <p className="text-muted-foreground mb-4">
        Click the button to open the dialog for managing un-curated blocks before handoff.
      </p>

      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        → Planner
      </button>

      <HandoffDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleHandoff}
        blocks={blocks}
      />

      <div className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold">Block Summary:</h2>
        <p className="text-sm">
          • {blocks.filter((b) => b.status === 'curated').length} curated blocks
        </p>
        <p className="text-sm">
          • {blocks.filter((b) => b.status !== 'curated').length} un-curated blocks
        </p>
      </div>
    </div>
  );
}

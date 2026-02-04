import { FormingBlocksColumn } from './FormingBlocksColumn';
import type { Block } from './FormingBlocksColumn';

/**
 * Helper to create example blocks with all required fields
 */
function createExampleBlock(
  partial: Pick<Block, 'id' | 'emoji' | 'keyword' | 'confidence' | 'status'>
): Block {
  return {
    ...partial,
    type: 'feature',
    title: `Example ${partial.keyword}`,
    content: `Description of ${partial.keyword.toLowerCase()} block.`,
    specialist: 'problem-finder',
    sourceContext: 'example',
    createdAt: new Date().toISOString(),
    curatedAt: partial.status === 'curated' ? new Date().toISOString() : null,
  };
}

/**
 * Example blocks with various confidence levels and statuses
 */
const exampleBlocks: Block[] = [
  createExampleBlock({
    id: 'block-1',
    emoji: '💡',
    keyword: 'Idea',
    confidence: 15,
    status: 'forming',
  }),
  createExampleBlock({
    id: 'block-2',
    emoji: '🎯',
    keyword: 'Goal',
    confidence: 45,
    status: 'emerging',
  }),
  createExampleBlock({
    id: 'block-3',
    emoji: '🚀',
    keyword: 'Feature',
    confidence: 75,
    status: 'developing',
  }),
  createExampleBlock({
    id: 'block-4',
    emoji: '✨',
    keyword: 'Polish',
    confidence: 95,
    status: 'ready',
  }),
  createExampleBlock({
    id: 'block-5',
    emoji: '📦',
    keyword: 'Done',
    confidence: 100,
    status: 'curated', // This one won't render (filtered out)
  }),
];

/**
 * Example: FormingBlocksColumn with mock blocks
 *
 * Shows the physics simulation in action with blocks at different
 * confidence levels and statuses. The curated block (#5) is filtered out.
 *
 * Usage:
 * ```tsx
 * import { FormingBlocksColumnExample } from './FormingBlocksColumn.example';
 *
 * function App() {
 *   return (
 *     <div style={{ width: '100%', height: '100vh' }}>
 *       <FormingBlocksColumnExample />
 *     </div>
 *   );
 * }
 * ```
 */
export function FormingBlocksColumnExample() {
  return (
    <div className="w-full h-screen">
      <FormingBlocksColumn
        blocks={exampleBlocks}
        onBlockClick={(id) => console.log('Block clicked:', id)}
        onBlockDragEnd={(id) => console.log('Block drag ended:', id)}
      />
    </div>
  );
}

/**
 * Example: Empty state (no blocks)
 */
export function FormingBlocksColumnEmptyExample() {
  return (
    <div className="w-full h-screen">
      <FormingBlocksColumn blocks={[]} />
    </div>
  );
}

/**
 * Example: Many blocks (stress test)
 */
export function FormingBlocksColumnManyBlocksExample() {
  const manyBlocks: Block[] = Array.from({ length: 20 }, (_, i) => {
    const emojis = ['💡', '🎯', '🚀', '✨', '🔥'];
    const keywords = ['Idea', 'Goal', 'Feature', 'Polish', 'Hot'];
    const statuses = ['forming', 'emerging', 'developing', 'ready'] as const;
    return createExampleBlock({
      id: `block-${i}`,
      emoji: emojis[i % 5]!,
      keyword: keywords[i % 5]!,
      confidence: Math.floor(Math.random() * 90), // 0-90 (non-curated)
      status: statuses[Math.floor(Math.random() * 4)]!,
    });
  });

  return (
    <div className="w-full h-screen">
      <FormingBlocksColumn
        blocks={manyBlocks}
        onBlockClick={(id) => console.log('Block clicked:', id)}
        onBlockDragEnd={(id) => console.log('Block drag ended:', id)}
      />
    </div>
  );
}

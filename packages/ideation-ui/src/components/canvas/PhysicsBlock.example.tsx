import { useRef } from 'react';
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';
import { PhysicsBlock, type BlockStatus } from './PhysicsBlock';

/**
 * Example usage of PhysicsBlock with usePhysicsEngine hook
 *
 * This demonstrates the integration pattern for physics-synced blocks:
 * 1. Create a container ref
 * 2. Initialize physics engine with the container
 * 3. Add bodies to physics world
 * 4. Render PhysicsBlock components synced to physics body positions
 */
export function PhysicsBlockExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { bodies, addBody, removeBody } = usePhysicsEngine(containerRef);

  // Example blocks data
  const blocks = [
    {
      id: 'block-1',
      emoji: '💡',
      keyword: 'Idea',
      confidence: 85,
      status: 'ready' as BlockStatus,
    },
    {
      id: 'block-2',
      emoji: '🎨',
      keyword: 'Design',
      confidence: 60,
      status: 'developing' as BlockStatus,
    },
    {
      id: 'block-3',
      emoji: '🚀',
      keyword: 'Launch',
      confidence: 40,
      status: 'emerging' as BlockStatus,
    },
    {
      id: 'block-4',
      emoji: '📊',
      keyword: 'Data',
      confidence: 20,
      status: 'forming' as BlockStatus,
    },
  ];

  // Calculate block size from confidence (example formula)
  const calculateSize = (confidence: number, status: BlockStatus): number => {
    if (status === 'forming') return 20;
    if (status === 'emerging') return 40 + (confidence - 30) * 0.6;
    if (status === 'developing') return 60 + (confidence - 60) * 0.6;
    if (status === 'ready') return 80 + (confidence - 90) * 2;
    return 100; // curated
  };

  // Add blocks to physics engine on mount
  // In a real implementation, this would be triggered by block creation events
  const handleAddBlock = (blockId: string, size: number) => {
    addBody({
      id: blockId,
      radius: size / 2, // Physics uses radius, not diameter
      restitution: 0.3, // Bounciness
      friction: 0.1,
      frictionAir: 0.02,
    });
  };

  const handleRemoveBlock = (blockId: string) => {
    removeBody(blockId);
  };

  const handleBlockClick = (blockId: string) => {
    console.log('Block clicked:', blockId);
  };


  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={() => handleAddBlock('block-1', 80)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add Block
        </button>
        <button
          onClick={() => handleRemoveBlock('block-1')}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Remove Block
        </button>
      </div>

      {/* Physics Container */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-bg-tertiary border border-border-default rounded-lg overflow-hidden"
      >
        {/* Render PhysicsBlocks synced to physics bodies */}
        {blocks.map((block) => {
          const body = bodies.get(block.id);
          if (!body) return null;

          const size = calculateSize(block.confidence, block.status);

          return (
            <PhysicsBlock
              key={block.id}
              block={block}
              position={{ x: body.x, y: body.y }}
              angle={body.angle}
              size={size}
              onClick={() => handleBlockClick(block.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

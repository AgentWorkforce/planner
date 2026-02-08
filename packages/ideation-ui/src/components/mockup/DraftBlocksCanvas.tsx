import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePhysicsEngine } from '@/hooks/mockup/usePhysicsEngine';
import { getBlockSize, shouldShowKeyword, type Block } from '@/lib/mockup/block-utils';
import { PhysicsBlock } from './PhysicsBlock';

const SYNONYM_WORDS = [
  'Evolving',
  'Unfolding',
  'Ripening',
  'Nurturing',
  'Cultivating',
  'Incubating',
  'Simmering',
  'Blossoming',
  'Flowering',
  'Maturing',
  'Progressing',
  'Forging',
  'Shaping',
  'Mellowing',
  'Germinating',
];

interface DraftBlocksCanvasProps {
  blocks: Block[];
  onBlockClick: (block: Block) => void;
  onAddBlock: () => void;
  pendingApprovalId: string | null;
  onApproveAnimationComplete: (id: string) => void;
}

export function DraftBlocksCanvas({
  blocks,
  onBlockClick,
  onAddBlock,
  pendingApprovalId,
  onApproveAnimationComplete,
}: DraftBlocksCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; angle: number }>>(new Map());
  const [animatingBlockId, setAnimatingBlockId] = useState<string | null>(null);
  const [animationStartPos, setAnimationStartPos] = useState<{ x: number; y: number } | null>(null);
  const [freshBlockIds, setFreshBlockIds] = useState<Set<string>>(new Set());
  const [synonymIndex, setSynonymIndex] = useState(0);
  const [exitingBlocks, setExitingBlocks] = useState<
    Array<{ block: Block; position: { x: number; y: number; angle: number }; size: number; showKeyword: boolean }>
  >([]);
  const seenBlockIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);
  const hasSynonymInitializedRef = useRef(false);
  const lastPositionsRef = useRef<Map<string, { x: number; y: number; angle: number }>>(new Map());
  const previousBlocksRef = useRef<Map<string, Block>>(new Map());
  const approvingIdsRef = useRef<Set<string>>(new Set());

  const handleBlocksUpdate = useCallback((next: Map<string, { x: number; y: number; angle: number }>) => {
    setPositions(new Map(next));
    lastPositionsRef.current = new Map(next);
  }, []);

  const { bodyMap } = usePhysicsEngine({
    containerRef,
    blocks,
    onBlocksUpdate: handleBlocksUpdate,
  });

  const handleApprove = useCallback(
    (id: string) => {
      approvingIdsRef.current.add(id);
      const body = bodyMap.get(id);
      if (body) {
        setAnimationStartPos({ x: body.position.x, y: body.position.y });
        setAnimatingBlockId(id);
      }

      setTimeout(() => {
        onApproveAnimationComplete(id);
        setAnimatingBlockId(null);
        setAnimationStartPos(null);
      }, 500);
    },
    [bodyMap, onApproveAnimationComplete],
  );

  useEffect(() => {
    if (pendingApprovalId) {
      handleApprove(pendingApprovalId);
    }
  }, [handleApprove, pendingApprovalId]);

  useEffect(() => {
    const draftIds = blocks.filter((block) => block.status === 'draft').map((block) => block.id);

    if (!hasInitializedRef.current) {
      seenBlockIdsRef.current = new Set(draftIds);
      hasInitializedRef.current = true;
      return;
    }

    const newIds = draftIds.filter((id) => !seenBlockIdsRef.current.has(id));
    if (newIds.length === 0) return;

    setFreshBlockIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) {
        next.add(id);
      }
      return next;
    });

    for (const id of newIds) {
      setTimeout(() => {
        setFreshBlockIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 450);
    }

    seenBlockIdsRef.current = new Set(draftIds);
  }, [blocks]);

  const blockSignature = useMemo(() => blocks.map((block) => block.id).join('|'), [blocks]);

  useEffect(() => {
    if (!hasSynonymInitializedRef.current) {
      hasSynonymInitializedRef.current = true;
      return;
    }
    setSynonymIndex((prev) => (prev + 1) % SYNONYM_WORDS.length);
  }, [blockSignature]);

  useEffect(() => {
    const currentIds = new Set(blocks.map((block) => block.id));
    const previousBlocks = previousBlocksRef.current;

    if (previousBlocks.size > 0) {
      for (const [id, block] of previousBlocks.entries()) {
        if (currentIds.has(id)) continue;
        if (approvingIdsRef.current.has(id)) {
          approvingIdsRef.current.delete(id);
          continue;
        }

        const position = lastPositionsRef.current.get(id);
        if (!position) continue;

        const size = getBlockSize(block.maturity);
        const showKeyword = shouldShowKeyword(size);

        setExitingBlocks((prev) => {
          if (prev.some((entry) => entry.block.id === id)) return prev;
          return [...prev, { block, position, size, showKeyword }];
        });

        setTimeout(() => {
          setExitingBlocks((prev) => prev.filter((entry) => entry.block.id !== id));
        }, 420);
      }
    }

    setExitingBlocks((prev) => prev.filter((entry) => !currentIds.has(entry.block.id)));
    previousBlocksRef.current = new Map(blocks.map((block) => [block.id, block]));
  }, [blocks]);

  const draftBlockBodies = useMemo(
    () =>
      blocks
        .filter((block) => block.status === 'draft')
        .map((block) => {
          const body = positions.get(block.id);
          if (!body) return null;
          const size = getBlockSize(block.maturity);
          return {
            block,
            body,
            size,
            showKeyword: shouldShowKeyword(size),
          };
        })
        .filter((entry): entry is { block: Block; body: { x: number; y: number; angle: number }; size: number; showKeyword: boolean } =>
          Boolean(entry),
        ),
    [blocks, positions],
  );

  return (
    <div className="w-[30%] flex-shrink-0 h-full flex flex-col gap-4">
      <div className="px-1">
        <p className="text-xl font-semibold text-[#2d2d2d]">
          <span key={synonymIndex} className="mockup-synonym">
            {SYNONYM_WORDS[synonymIndex]}
          </span>{' '}
          Blocks
        </p>
      </div>
      <div ref={containerRef} className="mockup-canvas mockup-canvas-grid relative flex-1 overflow-hidden">
        {draftBlockBodies.map((entry) =>
          entry ? (
            <div
              key={entry.block.id}
              className="absolute cursor-pointer"
              style={{
                left: entry.body.x - entry.size / 2,
                top: entry.body.y - entry.size / 2,
                width: entry.size,
                height: entry.size,
                zIndex: Math.round(entry.block.confidence),
                transform: `rotate(${entry.body.angle}rad)`,
                transition: 'width 0.3s ease, height 0.3s ease',
              }}
              onClick={() => onBlockClick(entry.block)}
            >
              <PhysicsBlock
                block={entry.block}
                showKeyword={entry.showKeyword}
                animateIn={freshBlockIds.has(entry.block.id)}
              />
            </div>
          ) : null,
        )}

        {exitingBlocks.map((entry) => (
          <div
            key={`exit-${entry.block.id}`}
            className="absolute pointer-events-none"
            style={{
              left: entry.position.x - entry.size / 2,
              top: entry.position.y - entry.size / 2,
              width: entry.size,
              height: entry.size,
              zIndex: Math.round(entry.block.confidence),
              transform: `rotate(${entry.position.angle}rad)`,
            }}
          >
            <PhysicsBlock block={entry.block} showKeyword={entry.showKeyword} animateOut />
          </div>
        ))}

        {animatingBlockId && animationStartPos && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: animationStartPos.x,
              top: animationStartPos.y,
              animation: 'approveSlide 500ms ease-out forwards',
            }}
          >
            <PhysicsBlock
              block={blocks.find((block) => block.id === animatingBlockId)!}
              showKeyword
            />
          </div>
        )}

      </div>
      <button
        type="button"
        onClick={onAddBlock}
        aria-label="Add developing block"
        className="self-start rounded-2xl border border-[#e0dbd3] bg-white/70 px-4 py-2 text-lg font-semibold text-[#2d2d2d] shadow-sm transition hover:bg-white/90 hover:shadow"
        style={{ marginLeft: 'calc(20px - 1.5rem)' }}
      >
        +
      </button>
    </div>
  );
}

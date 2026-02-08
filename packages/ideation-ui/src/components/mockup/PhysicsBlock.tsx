import { getConfidenceStyle, type Block } from '@/lib/mockup/block-utils';

interface PhysicsBlockProps {
  block: Block;
  showKeyword: boolean;
  animateIn?: boolean;
  animateOut?: boolean;
}

export function PhysicsBlock({ block, showKeyword, animateIn = false, animateOut = false }: PhysicsBlockProps) {
  const confidenceStyle = getConfidenceStyle(block.confidence);
  const animationClass = animateOut ? 'mockup-block-pop-out' : animateIn ? 'mockup-block-pop' : '';

  return (
    <div
      className={`w-full h-full rounded-xl bg-[var(--mockup-block-draft)] shadow-md flex flex-col items-center justify-center p-1 hover:shadow-lg transition-all select-none ${animationClass}`}
      style={{
        borderStyle: 'solid',
        ...confidenceStyle,
      }}
    >
      <span className="text-2xl">{block.emoji}</span>
      {showKeyword && (
        <span className="text-[10px] text-[#7a7a7a] mt-0.5 truncate max-w-full px-1 uppercase tracking-wide">
          {block.keyword}
        </span>
      )}
    </div>
  );
}

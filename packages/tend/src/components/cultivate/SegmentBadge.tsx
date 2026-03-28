import { cn } from '@/lib/utils';

const SEGMENT_STYLES: Record<string, { bg: string; text: string }> = {
  'Power Users': { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  'Feature Requesters': { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  'Bug Reporters': { bg: 'bg-red-500/10', text: 'text-red-400' },
  'Engaged Community': { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  'One-time Contributors': { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
};

interface SegmentBadgeProps {
  segment: string;
  className?: string;
}

export function SegmentBadge({ segment, className }: SegmentBadgeProps) {
  const style = SEGMENT_STYLES[segment] ?? { bg: 'bg-neutral-500/10', text: 'text-neutral-400' };
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
        style.bg,
        style.text,
        className
      )}
    >
      {segment}
    </span>
  );
}

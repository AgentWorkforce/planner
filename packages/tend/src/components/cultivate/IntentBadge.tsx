import { cn } from '@/lib/utils';

const INTENT_COLORS: Record<string, { bg: string; text: string }> = {
  bug_report: { bg: 'bg-red-500/10', text: 'text-red-400' },
  feature_request: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  product_feedback: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  question: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  noise: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
  unclassified: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
};

interface IntentBadgeProps {
  intent: string;
  className?: string;
}

export function IntentBadge({ intent, className }: IntentBadgeProps) {
  const colors = INTENT_COLORS[intent] ?? INTENT_COLORS.unclassified;
  const label = intent.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
        colors.bg,
        colors.text,
        className
      )}
    >
      {label}
    </span>
  );
}

import { cn } from '@/lib/utils';

interface SentimentBarProps {
  distribution: {
    frustrated: number;
    disappointed: number;
    neutral: number;
    hopeful: number;
    enthusiastic: number;
    total: number;
  };
}

const SENTIMENT_LEVELS = [
  { key: 'frustrated', label: 'Frustrated', color: 'bg-red-500' },
  { key: 'disappointed', label: 'Disappointed', color: 'bg-amber-500' },
  { key: 'neutral', label: 'Neutral', color: 'bg-gray-400' },
  { key: 'hopeful', label: 'Hopeful', color: 'bg-blue-400' },
  { key: 'enthusiastic', label: 'Enthusiastic', color: 'bg-emerald-500' },
] as const;

type SentimentKey = (typeof SENTIMENT_LEVELS)[number]['key'];

export function SentimentBar({ distribution }: SentimentBarProps) {
  const { total } = distribution;

  if (total <= 0) return null;

  // Check if all signals are neutral
  const nonNeutralCount = total - distribution.neutral;
  if (nonNeutralCount === 0) {
    return (
      <div className="px-1">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1.5">
          Sentiment
        </p>
        <p className="text-xs text-text-muted">All neutral</p>
      </div>
    );
  }

  // Build segments with percentages
  const segments = SENTIMENT_LEVELS
    .map(({ key, label, color }) => {
      const count = distribution[key as SentimentKey];
      const percent = (count / total) * 100;
      return { key, label, color, count, percent };
    })
    .filter(s => s.count > 0);

  // Apply minimum width for visibility (2%), redistribute proportionally
  const MIN_WIDTH = 2;
  const rawWidths = segments.map(s => Math.max(s.percent, MIN_WIDTH));
  const total_width = rawWidths.reduce((a, b) => a + b, 0);
  const scale = total_width > 0 ? 100 / total_width : 1;
  const adjustedSegments = segments.map((s, i) => ({
    ...s,
    displayWidth: rawWidths[i] * scale,
  }));

  // Labels for segments > 10%
  const significantSegments = segments.filter(s => s.percent > 10);

  return (
    <div className="px-1">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1.5">
        Sentiment
      </p>

      <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden flex">
        {adjustedSegments.map((segment, i) => (
          <div
            key={segment.key}
            className={cn(
              'h-full transition-all',
              segment.color,
              i === 0 && 'rounded-l-full',
              i === adjustedSegments.length - 1 && 'rounded-r-full',
            )}
            style={{ width: `${segment.displayWidth}%` }}
          />
        ))}
      </div>

      {significantSegments.length > 0 && (
        <p className="text-xs text-text-muted mt-1.5">
          {significantSegments
            .map(s => `${Math.round(s.percent)}% ${s.label.toLowerCase()}`)
            .join(' \u00b7 ')}
        </p>
      )}
    </div>
  );
}

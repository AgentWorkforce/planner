import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui';

interface ConfidenceBarProps {
  score: number;
  breakdown?: Record<string, number>;
}

function getSegmentCount(score: number): number {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

function getSegmentColor(index: number, filledCount: number): string {
  if (index >= filledCount) {
    return 'bg-bg-tertiary';
  }

  // Color based on position in the bar
  switch (filledCount) {
    case 1:
      return 'bg-error';
    case 2:
      return index === 0 ? 'bg-error' : 'bg-warning';
    case 3:
      return 'bg-warning';
    case 4:
      return index < 2 ? 'bg-warning' : 'bg-success';
    case 5:
      return 'bg-success';
    default:
      return 'bg-bg-tertiary';
  }
}

export function ConfidenceBar({ score, breakdown = {} }: ConfidenceBarProps) {
  const filledCount = getSegmentCount(score);
  const hasBreakdown = Object.keys(breakdown).length > 0;

  const bar = (
    <div className="flex gap-1 items-center">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className={cn(
            'w-2 h-3 rounded-sm transition-colors',
            getSegmentColor(index, filledCount)
          )}
        />
      ))}
      <span className="ml-2 text-xs text-text-muted">{Math.round(score)}%</span>
    </div>
  );

  if (!hasBreakdown) {
    return bar;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{bar}</div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium mb-1">Confidence by Specialist</p>
            {Object.entries(breakdown).map(([specialist, value]) => (
              <div key={specialist} className="flex justify-between gap-4">
                <span>{specialist}</span>
                <span>{Math.round(value)}%</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

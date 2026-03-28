import { cn } from '@/lib/utils';

type ConfidenceLevel = 'exploring' | 'forming' | 'confident';

interface ConfidenceDotsProps {
  level: ConfidenceLevel;
}

function getDotClass(index: number, level: ConfidenceLevel): string {
  switch (level) {
    case 'exploring':
      return 'bg-accent-purple/30';
    case 'forming':
      return index < 2 ? 'bg-warning' : 'bg-accent-purple/30';
    case 'confident':
      return 'bg-success';
    default:
      return 'bg-accent-purple/30';
  }
}

export function ConfidenceDots({ level }: ConfidenceDotsProps) {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-colors',
            getDotClass(index, level)
          )}
        />
      ))}
    </div>
  );
}

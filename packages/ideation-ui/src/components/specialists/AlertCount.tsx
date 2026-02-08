import { cn } from '@/lib/utils';
import { AlertIcon, HelpCircleIcon } from '@/components/icons';

type AlertType = 'concern' | 'question';

interface AlertCountProps {
  type: AlertType;
  count: number;
}

export function AlertCount({ type, count }: AlertCountProps) {
  if (count === 0) {
    return null;
  }

  const isConcern = type === 'concern';
  const Icon = isConcern ? AlertIcon : HelpCircleIcon;
  const colorClass = isConcern ? 'text-warning' : 'text-accent-purple';

  return (
    <div className={cn('flex items-center gap-1 text-xs', colorClass)}>
      <Icon size="sm" />
      <span>{count}</span>
    </div>
  );
}

import { ChevronRight } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function ChevronRightIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <ChevronRight
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

import { ChevronLeft } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function ChevronLeftIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <ChevronLeft
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

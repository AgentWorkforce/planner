import { Rows3 } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function RowsIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <Rows3
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

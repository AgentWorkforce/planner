import { Columns3 } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function ColumnsIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <Columns3
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

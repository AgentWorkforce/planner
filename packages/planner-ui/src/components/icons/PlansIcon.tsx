import { FileText } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function PlansIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <FileText
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

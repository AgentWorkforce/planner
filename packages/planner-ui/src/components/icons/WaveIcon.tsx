import { Waves } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function WaveIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <Waves
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

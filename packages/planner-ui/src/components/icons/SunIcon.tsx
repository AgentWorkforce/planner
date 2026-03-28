import { Sun } from 'lucide-react';
import type { IconProps } from './types';
import { iconSizes } from './types';

export function SunIcon({ size = 'md', className }: IconProps) {
  return <Sun size={iconSizes[size]} className={className} />;
}

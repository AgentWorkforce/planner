import { Moon } from 'lucide-react';
import type { IconProps } from './types';
import { iconSizes } from './types';

export function MoonIcon({ size = 'md', className }: IconProps) {
  return <Moon size={iconSizes[size]} className={className} />;
}

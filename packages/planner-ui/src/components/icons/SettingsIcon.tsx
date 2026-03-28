import { Settings } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function SettingsIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <Settings
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

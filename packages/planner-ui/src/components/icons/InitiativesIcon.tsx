import { FolderKanban } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function InitiativesIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <FolderKanban
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

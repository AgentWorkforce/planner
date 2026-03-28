import { LayoutDashboard } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function DashboardIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <LayoutDashboard
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

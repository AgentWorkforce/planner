import { GitBranch } from 'lucide-react';
import { IconProps, iconSizes } from './types';

export function PipelineIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <GitBranch
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

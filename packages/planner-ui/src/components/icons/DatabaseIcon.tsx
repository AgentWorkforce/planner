import { Database } from 'lucide-react';
import { IconProps, iconSizes } from './types';

/**
 * Database icon (for modeler role).
 * Used in Context UI for data modeling observations.
 */
export function DatabaseIcon({ size = 'md', className = '' }: IconProps) {
  const s = iconSizes[size];
  return (
    <Database
      width={s}
      height={s}
      className={className}
      strokeWidth={2}
    />
  );
}

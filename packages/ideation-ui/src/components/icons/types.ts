export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  size?: IconSize;
  className?: string;
}

export const iconSizes: Record<IconSize, number> = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

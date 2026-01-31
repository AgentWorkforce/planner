/**
 * Badge component displaying initiative association on plan cards.
 * Shows a colored circle indicator and name in a neutral gray badge.
 */

interface InitiativeBadgeProps {
  initiative: {
    initiative_id: string;
    name: string;
    icon?: string;
    color?: string;
  };
  size?: 'sm' | 'md';
  className?: string;
}

export function InitiativeBadge({
  initiative,
  size = 'sm',
  className = '',
}: InitiativeBadgeProps) {
  // Default color if not provided
  const color = initiative.color || '#00d9ff';

  // Size variants
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded bg-bg-tertiary text-text-secondary ${sizeClasses[size]} ${className}`}
    >
      <span
        className={`${dotSizes[size]} rounded-full flex-shrink-0`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="leading-none">{initiative.name}</span>
    </span>
  );
}

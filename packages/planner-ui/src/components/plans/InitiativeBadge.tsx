/**
 * Badge component displaying initiative association on plan cards.
 * Shows initiative icon (emoji) and name with initiative-specific coloring.
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

/**
 * Converts hex color to RGB with alpha channel for background/border opacity
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function InitiativeBadge({
  initiative,
  size = 'sm',
  className = '',
}: InitiativeBadgeProps) {
  // Default color if not provided
  const color = initiative.color || '#9333ea'; // accent-purple-600

  // Size variants
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: hexToRgba(color, 0.1),
        borderColor: hexToRgba(color, 0.3),
        color: color,
      }}
    >
      {initiative.icon && (
        <span className="leading-none" aria-hidden="true">
          {initiative.icon}
        </span>
      )}
      <span className="leading-none">{initiative.name}</span>
    </span>
  );
}

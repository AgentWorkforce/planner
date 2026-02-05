import { cn } from '@/lib/utils';

export interface SpecialistPerspectiveCardProps {
  name: string;
  take: string;
  concerns: string[];
  confidence: 'exploring' | 'forming' | 'confident';
  onClick?: () => void;
  className?: string;
}

/**
 * SpecialistPerspectiveCard
 *
 * Displays a specialist's synthesized perspective with their take, concerns, and confidence level.
 * Used in the AI Understanding drawer to show individual specialist insights.
 *
 * @example
 * ```tsx
 * <SpecialistPerspectiveCard
 *   name="Architect"
 *   take="REST API with session-based auth is the right approach given the requirements."
 *   concerns={["Scaling with many concurrent users", "Need rate limiting for API endpoints"]}
 *   confidence="confident"
 *   onClick={() => console.log('Show detailed view')}
 * />
 * ```
 */
export function SpecialistPerspectiveCard({
  name,
  take,
  concerns,
  confidence,
  onClick,
  className,
}: SpecialistPerspectiveCardProps) {
  const avatar = getSpecialistAvatar(name);

  const getConfidenceColor = () => {
    switch (confidence) {
      case 'exploring':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'forming':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'confident':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        onClick && 'cursor-pointer hover:bg-muted/50 transition-colors',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {avatar}
          </span>
          <span className="font-medium text-sm">{name}</span>
        </div>
        <span
          className={cn('text-xs px-2 py-0.5 rounded-full capitalize', getConfidenceColor())}
          aria-label={`Confidence level: ${confidence}`}
        >
          {confidence}
        </span>
      </div>

      {/* Take */}
      <p className="text-sm italic text-muted-foreground">"{take}"</p>

      {/* Concerns */}
      {concerns.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Concerns:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {concerns.map((concern, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-muted-foreground/50" aria-hidden="true">
                  •
                </span>
                {concern}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to map specialist names to emoji avatars.
 * Provides visual identification for different specialist roles.
 */
function getSpecialistAvatar(name: string): string {
  const avatars: Record<string, string> = {
    architect: '🏗️',
    designer: '🎨',
    engineer: '⚙️',
    security: '🔐',
    data: '📊',
    product: '📋',
  };
  return avatars[name.toLowerCase()] || '👤';
}

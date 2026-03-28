/**
 * PreferencesSummary Component
 *
 * Read-only card showing preferences derived from trajectory queries.
 * Displays category badges, preference text, and confidence scores.
 *
 * Returns null if no preferences exist.
 *
 * Props:
 * - preferences: Array of derived preferences to display
 */

import type { DerivedPreference } from '@/types/trajectory';

interface PreferencesSummaryProps {
  preferences: DerivedPreference[];
}

/**
 * Get badge color classes based on preference category.
 * Each category gets a distinct accent color for visual differentiation.
 */
function getCategoryBadgeClasses(category: string): string {
  const categoryLower = category.toLowerCase();

  switch (categoryLower) {
    case 'architecture':
      return 'bg-accent-purple/20 text-accent-purple';
    case 'testing':
      return 'bg-accent-green/20 text-accent-green';
    case 'naming':
      return 'bg-accent-cyan/20 text-accent-cyan';
    case 'performance':
      return 'bg-accent-orange/20 text-accent-orange';
    default:
      return 'bg-bg-elevated text-text-muted';
  }
}

/**
 * Format confidence score as percentage.
 * Example: 0.85 -> "85%"
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function PreferencesSummary({ preferences }: PreferencesSummaryProps) {
  // Only render if preferences exist
  if (preferences.length === 0) {
    return null;
  }

  return (
    <div className="bg-bg-secondary rounded-lg p-4 mb-4">
      {/* Title */}
      <h3 className="text-sm font-medium text-text-muted mb-3">
        Derived Preferences
      </h3>

      {/* Preferences list */}
      <div className="space-y-2">
        {preferences.map((preference) => (
          <div
            key={preference.preference_id}
            className="flex items-start gap-2 py-2"
          >
            {/* Category badge */}
            <span
              className={`
                text-xs px-2 py-0.5 rounded font-medium flex-shrink-0
                ${getCategoryBadgeClasses(preference.category)}
              `}
            >
              {preference.category}
            </span>

            {/* Preference text */}
            <p className="text-sm text-text-primary flex-1">
              {preference.preference_text}
            </p>

            {/* Confidence score */}
            <span className="text-xs text-text-muted flex-shrink-0">
              {formatConfidence(preference.confidence)} confident
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

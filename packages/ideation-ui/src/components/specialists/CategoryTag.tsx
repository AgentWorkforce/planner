import { formatCategoryName } from '@/lib/category-utils';

interface CategoryTagProps {
  name: string; // Raw key like 'system_design'
  confidence?: number; // 0-100, optional
}

/**
 * CategoryTag component renders a pill-shaped tag for specialist categories
 *
 * Visual indication for low confidence:
 * - Normal (>=50%): cyan accent with transparent border
 * - Low confidence (<50%): warning color with visible border
 */
export function CategoryTag({ name, confidence }: CategoryTagProps) {
  const displayName = formatCategoryName(name);
  const isLowConfidence = confidence !== undefined && confidence < 50;

  const baseClasses =
    'inline-block text-xs px-2 py-0.5 rounded-full transition-colors';
  const variantClasses = isLowConfidence
    ? 'bg-warning/10 text-warning border border-warning/30'
    : 'bg-accent-cyan/10 text-accent-cyan border border-transparent';

  return (
    <span
      className={`${baseClasses} ${variantClasses}`}
      title={
        confidence !== undefined
          ? `${displayName} (${confidence}% confidence)`
          : displayName
      }
    >
      {displayName}
    </span>
  );
}

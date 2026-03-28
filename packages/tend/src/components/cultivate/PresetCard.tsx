import { cn } from '@/lib/utils';
import type { PresetEntry } from '@/hooks/useCultivatePresets';

interface PresetCardProps {
  preset: PresetEntry;
  selected: boolean;
  onToggle: () => void;
}

function getAuthorityLabel(authority: number): { label: string; className: string } {
  if (authority >= 0.8) {
    return { label: '\u2605 High', className: 'text-green-400' };
  }
  if (authority >= 0.5) {
    return { label: '\u2605 Medium', className: 'text-blue-400' };
  }
  return { label: '\u2605 Low', className: 'text-text-muted' };
}

/**
 * PresetCard — selectable card for a source preset in the onboarding wizard.
 */
export function PresetCard({ preset, selected, onToggle }: PresetCardProps) {
  const authority = getAuthorityLabel(preset.preset.authority);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
        selected
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
          : 'border-border-subtle hover:border-border-default bg-bg-secondary'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-text-primary font-medium">
          {preset.preset.name}
        </p>
        <span className={cn('text-[10px] shrink-0', authority.className)}>
          {authority.label}
        </span>
      </div>
      {preset.preset.description && (
        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
          {preset.preset.description}
        </p>
      )}
    </button>
  );
}

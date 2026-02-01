import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';

interface SpecEmptyStateProps {
  message: string;
  cta: string;
  onAdd: () => void;
  disabled?: boolean;
}

/**
 * Empty state component for specification sections.
 *
 * Displays a centered message with an "Add" button CTA.
 * Used when a specification domain has no content.
 */
export function SpecEmptyState({ message, cta, onAdd, disabled }: SpecEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-text-muted mb-4">{message}</p>
      {!disabled && (
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <PlusIcon size="sm" />
          {cta}
        </Button>
      )}
    </div>
  );
}

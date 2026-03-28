import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import type {
  Initiative,
  CreateInitiativeInput,
  UpdateInitiativeInput,
} from '@/types/initiative';

/**
 * InitiativeModal Component
 *
 * Modal for creating and editing initiatives.
 * Uses Sheet component for the modal implementation.
 * Supports both create (no initiative prop) and edit (initiative prop provided) modes.
 *
 * Features:
 * - Name input (required, autofocus)
 * - Description textarea (optional)
 * - Icon picker (emoji selection)
 * - Color picker (preset swatches)
 * - Form validation
 * - Loading state during save
 * - Error handling
 *
 * @example
 * // Create mode
 * <InitiativeModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onSave={async (data) => { await createInitiative(data); }}
 * />
 *
 * @example
 * // Edit mode
 * <InitiativeModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   initiative={existingInitiative}
 *   onSave={async (data) => { await updateInitiative(initiative.id, data); }}
 * />
 */
interface InitiativeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiative?: Initiative; // undefined = create, defined = edit
  onSave: (data: CreateInitiativeInput | UpdateInitiativeInput) => Promise<void>;
}

// Default values for new initiatives
const DEFAULT_ICON = '🚀';
const DEFAULT_COLOR = '#00d9ff'; // Cyan

export function InitiativeModal({
  open,
  onOpenChange,
  initiative,
  onSave,
}: InitiativeModalProps) {
  const isEditMode = !!initiative;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when initiative prop changes
  useEffect(() => {
    if (initiative) {
      setName(initiative.name);
      setDescription(initiative.description || '');
      setIcon(initiative.icon || DEFAULT_ICON);
      setColor(initiative.color || DEFAULT_COLOR);
    } else {
      // Reset to defaults for create mode
      setName('');
      setDescription('');
      setIcon(DEFAULT_ICON);
      setColor(DEFAULT_COLOR);
    }
    setError(null); // Clear errors when opening
  }, [initiative, open]); // Reset when modal opens or initiative changes

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validation
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Name is required');
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const data: CreateInitiativeInput | UpdateInitiativeInput = {
          name: trimmedName,
          description: description.trim() || undefined,
          icon,
          color,
        };

        await onSave(data);
        onOpenChange(false); // Close modal on success
      } catch (err) {
        console.error('Error saving initiative:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to save initiative. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [name, description, icon, color, onSave, onOpenChange]
  );

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Initiative' : 'New Initiative'}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the details of this initiative.'
              : 'Create a new initiative to organize your plans.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-6">
          {/* Name input */}
          <div className="space-y-2">
            <label htmlFor="initiative-name" className="block text-sm font-medium text-text-primary">
              Name <span className="text-error">*</span>
            </label>
            <Input
              id="initiative-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Product Launch"
              autoFocus
              disabled={isLoading}
              className="w-full"
              required
            />
          </div>

          {/* Description textarea */}
          <div className="space-y-2">
            <label
              htmlFor="initiative-description"
              className="block text-sm font-medium text-text-primary"
            >
              Description
            </label>
            <textarea
              id="initiative-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this initiative..."
              disabled={isLoading}
              rows={3}
              className="
                w-full
                px-3 py-2
                text-sm
                bg-transparent
                border border-input
                rounded-md
                text-text-primary
                placeholder:text-muted-foreground
                transition-colors
                focus-visible:outline-none
                focus-visible:ring-1
                focus-visible:ring-ring
                disabled:cursor-not-allowed
                disabled:opacity-50
                resize-none
              "
            />
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Icon</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="px-3 py-2 text-sm text-error bg-error/10 border border-error/20 rounded-md"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Footer buttons */}
          <SheetFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>{isEditMode ? 'Save Changes' : 'Create Initiative'}</>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

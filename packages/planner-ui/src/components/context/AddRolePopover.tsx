/**
 * AddRolePopover Component
 *
 * Popover for adding roles to context with suggested roles and custom role input.
 * Opens when clicking a trigger (usually a "+" button).
 *
 * @example
 * ```tsx
 * <AddRolePopover
 *   existingRoles={['Designer', 'Architect']}
 *   onAddRole={(role) => console.log('Adding role:', role)}
 *   trigger={
 *     <button className="px-2 py-1 text-accent-cyan hover:bg-bg-deep rounded">
 *       + Add Role
 *     </button>
 *   }
 * />
 * ```
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddRolePopoverProps {
  /** Roles already added (to disable them in suggestions) */
  existingRoles: string[];
  /** Callback when a role is selected/added */
  onAddRole: (role: string) => void;
  /** The trigger element (usually a "+" button) */
  trigger: React.ReactNode;
}

/**
 * Suggested roles based on common agent personas.
 * Matches the agent roles from config/agentRoles.ts
 */
const SUGGESTED_ROLES = [
  'Designer',
  'Architect',
  'Modeler',
  'Tester',
  'Security',
];

/**
 * Content of the add role popover.
 */
function AddRolePopoverContent({
  existingRoles,
  onAddRole,
  onClose,
}: {
  existingRoles: string[];
  onAddRole: (role: string) => void;
  onClose: () => void;
}) {
  const [customRole, setCustomRole] = useState('');

  const handleSuggestedRole = (role: string) => {
    onAddRole(role);
    onClose();
  };

  const handleCustomRole = () => {
    const trimmedRole = customRole.trim();
    if (trimmedRole) {
      onAddRole(trimmedRole);
      setCustomRole('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomRole();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="w-64 bg-bg-tertiary border border-border-subtle rounded-lg shadow-lg p-3">
      {/* Header */}
      <div className="pb-2 border-b border-border-subtle">
        <span className="text-sm font-medium text-text-primary">
          Add Role
        </span>
      </div>

      {/* Suggested roles */}
      <div className="mt-2 space-y-1">
        <div className="text-xs text-text-muted mb-1">Suggested:</div>
        {SUGGESTED_ROLES.map((role) => {
          const isDisabled = existingRoles.includes(role);
          return (
            <button
              key={role}
              onClick={() => !isDisabled && handleSuggestedRole(role)}
              disabled={isDisabled}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                isDisabled
                  ? 'text-text-muted cursor-not-allowed opacity-50'
                  : 'text-text-secondary hover:bg-bg-deep hover:text-text-primary cursor-pointer'
              )}
            >
              {role}
              {isDisabled && (
                <span className="ml-2 text-xs text-text-muted">(added)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom role input */}
      <div className="mt-3 pt-3 border-t border-border-subtle">
        <div className="text-xs text-text-muted mb-1">Custom role:</div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter role name..."
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-8 text-sm"
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCustomRole}
            disabled={!customRole.trim()}
            className="h-8 px-3 text-xs"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Full popover with positioning and backdrop.
 */
export function AddRolePopover({
  existingRoles,
  onAddRole,
  trigger,
}: AddRolePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => setIsOpen(false);

  return (
    <div className="relative inline-block">
      {/* Trigger */}
      <div onClick={() => setIsOpen((prev) => !prev)}>{trigger}</div>

      {/* Popover */}
      {isOpen && (
        <>
          {/* Backdrop to catch outside clicks */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Popover positioned below the trigger */}
          <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
            <AddRolePopoverContent
              existingRoles={existingRoles}
              onAddRole={onAddRole}
              onClose={handleClose}
            />
          </div>
        </>
      )}
    </div>
  );
}

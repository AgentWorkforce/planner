import { useState, useCallback, useEffect } from 'react';
import type { Context } from '@/types';
import { RoleContextCard } from './context/RoleContextCard';
import { AddRolePopover } from './context/AddRolePopover';
import { Button } from './ui/Button';
import { PlusIcon, SettingsIcon } from '@/components/icons';
import { updateContext } from '@/api/client';
import { cn } from '@/lib/utils';
import { useToastContext } from '@/contexts';

interface ContextTabProps {
  planId: string;
  context?: Context;
  isEditable: boolean;
  onContextUpdate?: (updatedContext: Context) => void;
}

/**
 * Role ordering for consistent display.
 * Common roles first, then alphabetical for others.
 */
const ROLE_ORDER = ['designer', 'architect', 'modeler', 'tester', 'security'];

/**
 * Sort roles for consistent display order.
 */
function sortRoles(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const aIndex = ROLE_ORDER.indexOf(a.toLowerCase());
    const bIndex = ROLE_ORDER.indexOf(b.toLowerCase());

    // Both in preferred order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Only a in preferred order
    if (aIndex !== -1) return -1;
    // Only b in preferred order
    if (bIndex !== -1) return 1;
    // Neither in preferred order, sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Count fields for a specific role context.
 */
function countRoleFields(roleContext?: Record<string, unknown>): number {
  if (!roleContext) return 0;
  return Object.keys(roleContext).length;
}

/**
 * Count total context fields across all roles.
 */
function countContextFields(context?: Context): number {
  if (!context) return 0;

  return Object.values(context).reduce((total, roleContext) => {
    return total + Object.keys(roleContext).length;
  }, 0);
}

/**
 * Role tab button component.
 */
function RoleTab({
  role,
  isSelected,
  fieldCount,
  onClick,
}: {
  role: string;
  isSelected: boolean;
  fieldCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap',
        isSelected
          ? 'bg-bg-secondary text-text-primary border-t border-x border-border-default'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
      )}
    >
      <span className="capitalize">{role}</span>
      {fieldCount > 0 && (
        <span
          className={cn(
            'px-1.5 py-0.5 rounded-full text-xs font-semibold',
            isSelected
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'bg-bg-tertiary text-text-muted'
          )}
        >
          {fieldCount}
        </span>
      )}
    </button>
  );
}

/**
 * Empty state component when no context exists.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-bg-tertiary mb-4">
        <SettingsIcon size="xl" className="text-text-muted" />
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">No context defined yet</h3>
      <p className="text-sm text-text-muted max-w-md">
        Add context to capture formalized decisions by role. Context helps guide implementation
        by documenting architectural decisions, design system choices, and other constraints.
      </p>
    </div>
  );
}

/**
 * Tab content showing plan-level context (formalized decisions by role).
 *
 * Displays:
 * - Header with title and total field count
 * - Tab bar with one tab per role + add button
 * - RoleContextCard for the selected role
 * - Empty state when no context exists
 */
export function ContextTab({
  planId,
  context = {},
  isEditable = false,
  onContextUpdate,
}: ContextTabProps) {
  const { addToast } = useToastContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const roles = sortRoles(Object.keys(context));
  const hasContext = roles.length > 0;
  const fieldCount = countContextFields(context);

  // Auto-select first role when roles change
  useEffect(() => {
    if (roles.length > 0 && (!selectedRole || !roles.includes(selectedRole))) {
      setSelectedRole(roles[0]);
    } else if (roles.length === 0) {
      setSelectedRole(null);
    }
  }, [roles, selectedRole]);

  // Handle role context update
  const handleRoleContextUpdate = useCallback(
    async (role: string, updatedRoleContext: Record<string, unknown>) => {
      if (!isEditable) return;

      setIsUpdating(true);
      try {
        const newContext = { ...context, [role]: updatedRoleContext };
        await updateContext(planId, role, updatedRoleContext);

        // Notify parent component
        if (onContextUpdate) {
          onContextUpdate(newContext);
        }
      } catch (error) {
        console.error('[ContextTab] Failed to update context:', error);
        addToast('Failed to update context', 'error');
      } finally {
        setIsUpdating(false);
      }
    },
    [planId, context, isEditable, onContextUpdate]
  );

  // Handle role deletion
  const handleRoleDelete = useCallback(
    async (role: string) => {
      if (!isEditable) return;

      setIsUpdating(true);
      try {
        // Delete by sending empty object
        await updateContext(planId, role, {});

        // Remove from local state
        const newContext = { ...context };
        delete newContext[role];

        if (onContextUpdate) {
          onContextUpdate(newContext);
        }
      } catch (error) {
        console.error('[ContextTab] Failed to delete role context:', error);
        addToast('Failed to delete role context', 'error');
      } finally {
        setIsUpdating(false);
      }
    },
    [planId, context, isEditable, onContextUpdate]
  );

  // Handle role addition
  const handleAddRole = useCallback(
    async (role: string) => {
      if (!isEditable) return;

      setIsUpdating(true);
      try {
        // Initialize with empty object
        await updateContext(planId, role, {});

        // Add to local state
        const newContext = { ...context, [role]: {} };

        if (onContextUpdate) {
          onContextUpdate(newContext);
        }

        // Select the newly added role
        setSelectedRole(role);
      } catch (error) {
        console.error('[ContextTab] Failed to add role:', error);
        addToast('Failed to add role', 'error');
      } finally {
        setIsUpdating(false);
      }
    },
    [planId, context, isEditable, onContextUpdate]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display font-semibold text-text-primary">
            Context
          </h2>
          {fieldCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-cyan/20 text-accent-cyan">
              {fieldCount}
            </span>
          )}
        </div>
        {hasContext && (
          <span className="text-xs text-text-muted">
            {roles.length} {roles.length === 1 ? 'role' : 'roles'}
          </span>
        )}
      </div>

      {/* Content */}
      {!hasContext ? (
        <div>
          <EmptyState />
          {isEditable && (
            <div className="flex justify-center mt-4">
              <AddRolePopover
                existingRoles={roles}
                onAddRole={handleAddRole}
                trigger={
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isUpdating}
                    className="bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30"
                  >
                    <PlusIcon size="sm" />
                    Add First Role
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tab bar with role tabs */}
          <div className="flex items-end gap-1 border-b border-border-default">
            <div className="flex items-center gap-1 overflow-x-auto">
              {roles.map((role) => (
                <RoleTab
                  key={role}
                  role={role}
                  isSelected={selectedRole === role}
                  fieldCount={countRoleFields(context[role])}
                  onClick={() => setSelectedRole(role)}
                />
              ))}
            </div>
            {isEditable && (
              <AddRolePopover
                existingRoles={roles}
                onAddRole={handleAddRole}
                trigger={
                  <button
                    disabled={isUpdating}
                    className="flex items-center justify-center w-8 h-8 mb-1 rounded text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-colors disabled:opacity-50"
                    title="Add role"
                  >
                    <PlusIcon size="sm" />
                  </button>
                }
              />
            )}
          </div>

          {/* Selected role content */}
          {selectedRole && context[selectedRole] && (
            <RoleContextCard
              role={selectedRole}
              context={context[selectedRole]}
              isEditable={isEditable}
              onChange={(updatedRoleContext) => handleRoleContextUpdate(selectedRole, updatedRoleContext)}
              onDelete={() => handleRoleDelete(selectedRole)}
            />
          )}
        </div>
      )}
    </div>
  );
}

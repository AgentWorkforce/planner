import { useMemo } from 'react';
import { KeyValueEditor } from './KeyValueEditor';
import {
  ArchitectIcon,
  DesignerIcon,
  DatabaseIcon,
  TesterIcon,
  SecurityIcon,
  SettingsIcon,
  TrashIcon,
} from '../icons';
import { Button } from '../ui/Button';

// Re-export SUGGESTED_ROLES from backend for field hints
const SUGGESTED_ROLES = {
  designer: {
    field_hints: {
      library: 'Component library (e.g., shadcn/ui)',
      theme: 'Theme decisions - feel, colors, etc.',
      typography: 'Font family decisions - display, body, mono',
      patterns: 'Pattern decisions - cards, buttons, forms',
      icons: 'Icon approach - inline SVG, icon library, etc.',
    },
  },
  architect: {
    field_hints: {
      tech_stack: 'Core technologies (e.g., TypeScript, Express, SQLite)',
      api_style: 'API design approach (e.g., REST with Zod validation)',
      storage: 'Storage technology and approach',
      boundaries: 'Component/service boundaries with ownership',
    },
  },
  modeler: {
    field_hints: {
      approach: 'Overall modeling approach (e.g., JSONB for nested data, relational for queried fields)',
      entities: 'Core domain entities',
      relationships: 'Key entity relationships (e.g., Plan 1:N PlanVersion)',
      conventions: 'Naming conventions, ID formats, timestamp handling',
      migrations: 'Migration strategy (e.g., idempotent, additive only)',
    },
  },
  tester: {
    field_hints: {
      framework: 'Testing framework (e.g., Vitest)',
      coverage_target: 'Coverage goal (e.g., 80%)',
      strategy: 'Test type strategy (e.g., unit + integration + e2e)',
      test_data: 'Required test data/fixtures',
    },
  },
  security: {
    field_hints: {
      auth: 'Authentication approach (e.g., JWT)',
      compliance: 'Compliance requirements (e.g., OWASP Top 10)',
      data_handling: 'Data handling policy (e.g., No PII stored)',
    },
  },
} as const;

interface RoleContextCardProps {
  role: string;
  context: Record<string, unknown>;
  isEditable: boolean;
  onChange: (context: Record<string, unknown>) => void;
  onDelete: () => void;
}

/**
 * RoleContextCard displays and edits context for a specific role.
 * Supports freeform key-value pairs with optional field hints from SUGGESTED_ROLES.
 *
 * Usage:
 * ```tsx
 * <RoleContextCard
 *   role="designer"
 *   context={{ library: 'shadcn/ui', theme: 'dark mode' }}
 *   isEditable={true}
 *   onChange={(updated) => handleUpdate('designer', updated)}
 *   onDelete={() => handleDeleteRole('designer')}
 * />
 * ```
 */
export function RoleContextCard({
  role,
  context,
  isEditable,
  onChange,
  onDelete,
}: RoleContextCardProps) {
  // Get field hints for this role if it's a known role
  const fieldHints = useMemo(() => {
    const normalizedRole = role.toLowerCase() as keyof typeof SUGGESTED_ROLES;
    return SUGGESTED_ROLES[normalizedRole]?.field_hints || {};
  }, [role]);

  // Get icon for role
  const RoleIcon = useMemo(() => {
    const normalizedRole = role.toLowerCase();
    switch (normalizedRole) {
      case 'designer':
        return DesignerIcon;
      case 'architect':
        return ArchitectIcon;
      case 'modeler':
        return DatabaseIcon;
      case 'tester':
        return TesterIcon;
      case 'security':
        return SecurityIcon;
      default:
        return SettingsIcon;
    }
  }, [role]);

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the context for role "${role}"? This action cannot be undone.`
    );
    if (confirmed) {
      onDelete();
    }
  };

  const isEmpty = Object.keys(context).length === 0;

  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <RoleIcon size="md" className="text-accent-cyan" />
          <h3 className="text-text-primary font-medium capitalize">{role}</h3>
        </div>

        {isEditable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-text-muted hover:text-error"
            title={`Delete ${role} context`}
          >
            <TrashIcon size="sm" />
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {isEmpty && !isEditable ? (
          <div className="px-4 py-6 text-center text-text-muted text-sm italic">
            No context defined for this role
          </div>
        ) : isEmpty && isEditable ? (
          <div className="px-4 py-6 text-center">
            <p className="text-text-muted text-sm mb-3">No fields yet</p>
            <p className="text-text-secondary text-xs">
              Click &quot;Add field&quot; below to add your first context field
            </p>
          </div>
        ) : null}

        <KeyValueEditor
          fields={context}
          onChange={onChange}
          isEditable={isEditable}
          fieldHints={fieldHints}
        />
      </div>
    </div>
  );
}

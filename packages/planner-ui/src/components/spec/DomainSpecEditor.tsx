/**
 * DomainSpecEditor Component
 *
 * Freeform key-value editor for a specification domain.
 * Reuses KeyValueEditor from context, with optional field hints for suggested domains.
 *
 * @example
 * ```tsx
 * <DomainSpecEditor
 *   domain="architecture"
 *   spec={{ decisions: [...], api_contracts: [...] }}
 *   isEditable={true}
 *   onChange={(newSpec) => handleUpdate(newSpec)}
 *   onDelete={() => handleDelete()}
 * />
 * ```
 */

import { useMemo } from 'react';
import { KeyValueEditor } from '../context/KeyValueEditor';
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

/**
 * Suggested domains and their field hints.
 * Matches SUGGESTED_DOMAINS from backend src/domain/specification.ts
 */
const SUGGESTED_DOMAINS = {
  architecture: {
    field_hints: {
      decisions: 'Array of {decision_id, decision, rationale, alternatives?}',
      api_contracts: 'Array of {endpoint, method, request_schema?, response_schema?}',
      boundaries: 'Array of {component_id, name, technology?, owns?}',
    },
  },
  model: {
    field_hints: {
      entities: 'Array of {entity_id, name, attributes?, type?}',
      relationships: 'Array of {from, to, cardinality, description?}',
      schemas: 'Array of {schema_id, format, content}',
      migrations: 'Array of {migration_id, description, sql?}',
    },
  },
  design: {
    field_hints: {
      components: 'Array of {component_id, name, props?, variants?, states?}',
      views: 'Array of {view_id, name, route?, components?}',
      interactions: 'Array of {trigger, action, feedback?}',
    },
  },
  testing: {
    field_hints: {
      test_cases: 'Array of {case_id, type, priority, description, steps?, expected_result?}',
      coverage_notes: 'String with coverage strategy notes',
    },
  },
  security: {
    field_hints: {
      requirements: 'Array of {requirement_id, category, description, priority}',
      threats: 'Array of {threat, likelihood, impact, mitigations?}',
    },
  },
} as const;

interface DomainSpecEditorProps {
  /** Domain name (e.g., 'architecture', 'testing', 'custom_domain') */
  domain: string;
  /** Current spec content for this domain */
  spec: Record<string, unknown>;
  /** Whether editing is allowed */
  isEditable: boolean;
  /** Called when spec changes */
  onChange: (spec: Record<string, unknown>) => void;
  /** Called when user wants to delete this domain */
  onDelete: () => void;
}

/**
 * DomainSpecEditor displays and edits specification for a specific domain.
 * Supports freeform key-value pairs with optional field hints from SUGGESTED_DOMAINS.
 */
export function DomainSpecEditor({
  domain,
  spec,
  isEditable,
  onChange,
  onDelete,
}: DomainSpecEditorProps) {
  // Get field hints for this domain if it's a suggested domain
  const fieldHints = useMemo(() => {
    const normalizedDomain = domain.toLowerCase() as keyof typeof SUGGESTED_DOMAINS;
    return SUGGESTED_DOMAINS[normalizedDomain]?.field_hints || {};
  }, [domain]);

  // Get icon for domain
  const DomainIcon = useMemo(() => {
    const normalizedDomain = domain.toLowerCase();
    switch (normalizedDomain) {
      case 'architecture':
        return ArchitectIcon;
      case 'design':
        return DesignerIcon;
      case 'model':
        return DatabaseIcon;
      case 'testing':
        return TesterIcon;
      case 'security':
        return SecurityIcon;
      default:
        return SettingsIcon;
    }
  }, [domain]);

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the "${domain}" specification? This action cannot be undone.`
    );
    if (confirmed) {
      onDelete();
    }
  };

  const isEmpty = Object.keys(spec).length === 0;

  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <DomainIcon size="md" className="text-accent-cyan" />
          <h3 className="text-text-primary font-medium capitalize">{domain}</h3>
        </div>

        {isEditable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-text-muted hover:text-error"
            title={`Delete ${domain} specification`}
          >
            <TrashIcon size="sm" />
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {isEmpty && !isEditable ? (
          <div className="px-4 py-6 text-center text-text-muted text-sm italic">
            No specification defined for this domain
          </div>
        ) : isEmpty && isEditable ? (
          <div className="px-4 py-6 text-center">
            <p className="text-text-muted text-sm mb-3">No fields yet</p>
            <p className="text-text-secondary text-xs">
              Click &quot;Add field&quot; below to add specification details
            </p>
          </div>
        ) : null}

        <KeyValueEditor
          fields={spec}
          onChange={onChange}
          isEditable={isEditable}
          fieldHints={fieldHints}
        />
      </div>
    </div>
  );
}

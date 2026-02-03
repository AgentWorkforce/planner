/**
 * StepsPreview - Collapsible preview of plan steps
 *
 * Shows steps grouped by scope, with gate indicators and expand/collapse per scope.
 */

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ForgeStep } from '@/types';

interface StepsPreviewProps {
  steps: ForgeStep[];
  className?: string;
}

/**
 * Chevron Icon
 */
function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'h-4 w-4 transition-transform duration-200',
        expanded && 'rotate-90',
        className
      )}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Gate Icon - Shield with check
 */
function GateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/**
 * Folder Icon
 */
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

interface ScopeGroup {
  scope: string;
  steps: ForgeStep[];
}

export function StepsPreview({ steps, className }: StepsPreviewProps) {
  // Group steps by scope
  const scopeGroups = useMemo(() => {
    const groups = new Map<string, ForgeStep[]>();

    for (const step of steps) {
      const scope = step.scope || 'default';
      if (!groups.has(scope)) {
        groups.set(scope, []);
      }
      groups.get(scope)!.push(step);
    }

    // Convert to array and sort by scope name
    return Array.from(groups.entries())
      .map(([scope, steps]) => ({ scope, steps }))
      .sort((a, b) => {
        // 'default' scope goes last
        if (a.scope === 'default') return 1;
        if (b.scope === 'default') return -1;
        return a.scope.localeCompare(b.scope);
      });
  }, [steps]);

  // Track expanded scopes - all collapsed by default
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());

  const toggleScope = (scope: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedScopes(new Set(scopeGroups.map((g) => g.scope)));
  };

  const collapseAll = () => {
    setExpandedScopes(new Set());
  };

  if (steps.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border-subtle bg-bg-surface p-6 text-center',
          className
        )}
      >
        <p className="text-text-muted">No steps in this plan</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-surface',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-text-muted"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h3 className="font-semibold text-text-primary">Steps Preview</h3>
          <span className="text-sm text-text-muted">({steps.length} total)</span>
        </div>

        {/* Expand/Collapse All */}
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Expand all
          </button>
          <span className="text-text-muted">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Scope Groups */}
      <div className="divide-y divide-border-subtle">
        {scopeGroups.map((group) => (
          <ScopeGroupSection
            key={group.scope}
            group={group}
            isExpanded={expandedScopes.has(group.scope)}
            onToggle={() => toggleScope(group.scope)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual scope group section
 */
interface ScopeGroupSectionProps {
  group: ScopeGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

function ScopeGroupSection({ group, isExpanded, onToggle }: ScopeGroupSectionProps) {
  const gateCount = group.steps.filter((s) => s.gate).length;

  return (
    <div>
      {/* Scope Header */}
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left',
          'hover:bg-bg-hover transition-colors'
        )}
      >
        <ChevronIcon expanded={isExpanded} className="text-text-muted" />
        <FolderIcon className="h-4 w-4 text-text-muted" />
        <span className="font-medium text-text-primary">
          {group.scope === 'default' ? 'Unscoped' : group.scope}
        </span>
        <span className="text-sm text-text-muted">
          ({group.steps.length} {group.steps.length === 1 ? 'step' : 'steps'})
        </span>
        {gateCount > 0 && (
          <span className="flex items-center gap-1 text-sm text-amber-500">
            <GateIcon className="h-3.5 w-3.5" />
            {gateCount}
          </span>
        )}
      </button>

      {/* Steps List */}
      {isExpanded && (
        <div className="border-t border-border-subtle bg-bg-deep/30">
          {group.steps.map((step, index) => (
            <div
              key={step.step_id}
              className={cn(
                'flex items-start gap-3 px-4 py-2.5 pl-12',
                index < group.steps.length - 1 && 'border-b border-border-subtle'
              )}
            >
              {/* Step Number */}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bg-tertiary text-xs font-medium text-text-secondary flex items-center justify-center">
                {index + 1}
              </span>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">
                    {step.title}
                  </span>
                  {step.gate && (
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-500"
                      title={`Requires ${step.gate.approver_role || 'human'} approval`}
                    >
                      <GateIcon className="h-3 w-3" />
                      Gate
                    </span>
                  )}
                </div>
                {step.description && (
                  <p className="mt-1 text-sm text-text-muted line-clamp-2">
                    {step.description}
                  </p>
                )}
                {step.dependencies && step.dependencies.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-text-muted">
                    <span>Depends on:</span>
                    {step.dependencies.map((dep, i) => (
                      <span key={dep}>
                        <code className="px-1 py-0.5 rounded bg-bg-tertiary font-mono">
                          {dep}
                        </code>
                        {i < step.dependencies!.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

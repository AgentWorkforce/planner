import { useState, useMemo } from 'react';
import type { Step, DomainSpec } from '@/types';
import { DomainSpecEditor } from './DomainSpecEditor';
import { AddDomainPopover } from './AddDomainPopover';
import { PlusIcon } from '../icons';
import { cn } from '@/lib/utils';

interface StepSpecificationTabsProps {
  step: Step;
  isEditable: boolean;
  /** Called when spec for a domain changes. Pass empty object {} to delete the domain. */
  onSpecUpdate: (domain: string, spec: DomainSpec) => void;
  /** Content to render in the Details tab */
  detailsContent: React.ReactNode;
}

type TabId = 'details' | string;

/**
 * Check if a domain spec has any content.
 */
function hasDomainContent(spec?: DomainSpec): boolean {
  if (!spec) return false;
  return Object.keys(spec).length > 0;
}

/**
 * Tabbed interface for step details and specification domains.
 *
 * Provides tabs for:
 * - Details: Existing step fields (description, scope, owner, dependencies, etc.)
 * - Dynamic domain tabs from specification keys (architecture, model, design, etc.)
 *
 * Tab triggers show a dot indicator when the corresponding domain has content.
 * Use the '+' button to add new domains (suggested or custom).
 */
export function StepSpecificationTabs({
  step,
  isEditable,
  onSpecUpdate,
  detailsContent,
}: StepSpecificationTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('details');

  // Get domain keys from specification
  const domains = useMemo(() => {
    return Object.keys(step.specification || {});
  }, [step.specification]);

  // Handle adding a new domain
  const handleAddDomain = (domain: string) => {
    // Initialize with empty object - this creates the domain
    onSpecUpdate(domain, {});
    // Switch to the new tab
    setActiveTab(domain);
  };

  // Handle deleting a domain (send empty object to API)
  const handleDeleteDomain = (domain: string) => {
    onSpecUpdate(domain, {});
    // Switch back to details tab
    setActiveTab('details');
  };

  // Handle domain spec changes
  const handleDomainChange = (domain: string, spec: DomainSpec) => {
    onSpecUpdate(domain, spec);
  };

  return (
    <div className="flex flex-col">
      {/* Tab Triggers */}
      <div className="flex border-b border-border-subtle overflow-x-auto">
        {/* Details tab (always present) */}
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={cn(
            'relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-inset',
            activeTab === 'details'
              ? 'text-text-primary border-b-2 border-accent-cyan -mb-px'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          Details
        </button>

        {/* Dynamic domain tabs */}
        {domains.map((domain) => {
          const isActive = activeTab === domain;
          const domainSpec = step.specification?.[domain] as DomainSpec | undefined;
          const showDot = hasDomainContent(domainSpec);

          return (
            <button
              key={domain}
              type="button"
              onClick={() => setActiveTab(domain)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-inset',
                isActive
                  ? 'text-text-primary border-b-2 border-accent-cyan -mb-px'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="capitalize">{domain}</span>
                {showDot && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-accent-cyan"
                    title={`${domain} has content`}
                  />
                )}
              </span>
            </button>
          );
        })}

        {/* Add domain button */}
        {isEditable && (
          <AddDomainPopover
            existingDomains={domains}
            onAddDomain={handleAddDomain}
            trigger={
              <button
                type="button"
                className={cn(
                  'px-3 py-2.5 text-sm font-medium transition-colors',
                  'text-text-muted hover:text-accent-cyan',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-inset'
                )}
                title="Add specification domain"
              >
                <PlusIcon size="sm" />
              </button>
            }
          />
        )}
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'details' && detailsContent}

        {activeTab !== 'details' && (
          <DomainSpecEditor
            domain={activeTab}
            spec={(step.specification?.[activeTab] as DomainSpec) || {}}
            isEditable={isEditable}
            onChange={(newSpec) => handleDomainChange(activeTab, newSpec)}
            onDelete={() => handleDeleteDomain(activeTab)}
          />
        )}
      </div>
    </div>
  );
}

import { useState, useCallback, useMemo, useRef } from 'react';
import { EditableText } from './EditableText';
import { EditableTextarea } from './EditableTextarea';
import { DependencyIndicator, type ConnectedStep, type DependencyDirection } from './DependencyIndicator';
import { ChevronIcon, TrashIcon, MessageIcon, ArchitectIcon, DesignerIcon, TesterIcon, SecurityIcon, DatabaseIcon, SettingsIcon } from './icons';
import { StepSpecificationTabs } from './spec';
import { AcceptanceCriteriaSection } from './step-editor/AcceptanceCriteriaSection';
import { DependenciesSection } from './step-editor/DependenciesSection';
import { ApprovalGateSection } from './step-editor/ApprovalGateSection';
import { updateStepSpecification } from '@/api/client';
import type { Step, DomainSpec } from '@/types';

const COMMON_ROLES = [
  'backend:Coder',
  'frontend:Coder',
  'fullstack:Coder',
  'devops:Engineer',
  'qa:Tester',
];

interface OwnerRoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function OwnerRoleSelector({ value, onChange, disabled }: OwnerRoleSelectorProps) {
  const [isCustom, setIsCustom] = useState(!COMMON_ROLES.includes(value) && value !== '');

  if (isCustom) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom role..."
          disabled={disabled}
        />
        <button
          type="button"
          className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-all duration-150 hover:border-border-light disabled:opacity-50"
          onClick={() => {
            setIsCustom(false);
            onChange('');
          }}
          disabled={disabled}
        >
          Use preset
        </button>
      </div>
    );
  }

  return (
    <select
      className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-text-primary text-sm focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
      value={value}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setIsCustom(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
      disabled={disabled}
    >
      <option value="">Select role...</option>
      {COMMON_ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
      <option value="__custom__">Custom...</option>
    </select>
  );
}

interface StepEditorProps {
  step: Step;
  allSteps: Step[];
  /** Plan ID for specification updates */
  planId: string;
  onUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  onDelete: (stepId: string) => Promise<void>;
  disabled?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  commentCount?: number;
  onOpenComments?: (stepId: string) => void;
  /** Called when hovering a dependency indicator */
  onIndicatorHover?: (direction: DependencyDirection | null) => void;
  /** Called when clicking a dependency indicator - scrolls to first connected step */
  onScrollToStep?: (stepId: string) => void;
  /** Whether this step card is being hovered (for indicator expansion) */
  isHovered?: boolean;
}

export function StepEditor({
  step,
  allSteps,
  planId,
  onUpdate,
  onDelete,
  disabled = false,
  isExpanded = false,
  onToggleExpand,
  commentCount = 0,
  onOpenComments,
  onIndicatorHover,
  onScrollToStep,
  isHovered = false,
}: StepEditorProps) {
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const specUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute dependency info for indicators
  const { incomingSteps, outgoingSteps, hasCrossScopeIncoming, hasCrossScopeOutgoing } = useMemo(() => {
    const incoming: ConnectedStep[] = [];
    const outgoing: ConnectedStep[] = [];
    let crossScopeIn = false;
    let crossScopeOut = false;

    const stepScope = step.scope || '';

    // Incoming: steps this step depends on
    for (const depId of step.dependencies || []) {
      const depStep = allSteps.find((s) => s.step_id === depId);
      if (depStep) {
        incoming.push({
          stepId: depStep.step_id,
          title: depStep.title,
          scope: depStep.scope,
        });
        if ((depStep.scope || '') !== stepScope) {
          crossScopeIn = true;
        }
      }
    }

    // Outgoing: steps that depend on this step
    for (const s of allSteps) {
      if (s.dependencies?.includes(step.step_id)) {
        outgoing.push({
          stepId: s.step_id,
          title: s.title,
          scope: s.scope,
        });
        if ((s.scope || '') !== stepScope) {
          crossScopeOut = true;
        }
      }
    }

    return {
      incomingSteps: incoming,
      outgoingSteps: outgoing,
      hasCrossScopeIncoming: crossScopeIn,
      hasCrossScopeOutgoing: crossScopeOut,
    };
  }, [step, allSteps]);

  const handleUpdate = useCallback(
    async (field: keyof Step, value: unknown) => {
      setSaving(true);
      try {
        await onUpdate(step.step_id, { [field]: value });
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, step.step_id]
  );

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(step.step_id);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }, [onDelete, step.step_id, confirmDelete]);

  const cancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  // Debounced specification update handler (300ms delay)
  const handleSpecUpdate = useCallback(
    (domain: string, spec: DomainSpec) => {
      // Clear any pending update
      if (specUpdateTimerRef.current) {
        clearTimeout(specUpdateTimerRef.current);
      }

      // Debounce the API call
      specUpdateTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await updateStepSpecification(planId, step.step_id, domain, spec);

          // Update local state
          const isDelete = Object.keys(spec).length === 0;
          let newSpecification = { ...step.specification };

          if (isDelete) {
            // Remove the domain entirely
            delete newSpecification[domain];
          } else {
            // Update/add the domain
            newSpecification[domain] = spec;
          }

          await onUpdate(step.step_id, {
            specification: Object.keys(newSpecification).length > 0 ? newSpecification : undefined,
          });
        } catch (error) {
          console.error('Failed to update specification:', error);
        } finally {
          setSaving(false);
        }
      }, 300);
    },
    [planId, step.step_id, step.specification, onUpdate]
  );

  const isEditable = !disabled && !saving;

  return (
    <div
      className={`relative bg-bg-card rounded-lg border transition-colors ${
        isExpanded ? 'border-accent-cyan/30' : 'border-border-subtle hover:border-border'
      }`}
    >
      {/* Dependency Indicators */}
      <DependencyIndicator
        direction="incoming"
        count={incomingSteps.length}
        hasCrossScope={hasCrossScopeIncoming}
        connectedSteps={incomingSteps}
        onHover={(hovered) => onIndicatorHover?.(hovered ? 'incoming' : null)}
        onClick={() => incomingSteps[0] && onScrollToStep?.(incomingSteps[0].stepId)}
        isParentHovered={isHovered}
      />
      <DependencyIndicator
        direction="outgoing"
        count={outgoingSteps.length}
        hasCrossScope={hasCrossScopeOutgoing}
        connectedSteps={outgoingSteps}
        onHover={(hovered) => onIndicatorHover?.(hovered ? 'outgoing' : null)}
        onClick={() => outgoingSteps[0] && onScrollToStep?.(outgoingSteps[0].stepId)}
        isParentHovered={isHovered}
      />

      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <ChevronIcon size="sm" direction={isExpanded ? 'down' : 'right'} />
        </button>

        <div className="flex-1 min-w-0">
          <EditableText
            value={step.title}
            onSave={(value) => handleUpdate('title', value)}
            placeholder="Enter step title..."
            disabled={!isEditable}
            className="text-sm font-medium text-text-primary"
          />
        </div>

        {/* Specification domain indicators - fixed width so scope doesn't shift */}
        <div className="flex-shrink-0 flex items-center gap-0.5 min-w-[60px] justify-end">
          {Object.entries(step.specification || {}).map(([domain, spec]) => {
            const hasContent = spec && typeof spec === 'object' && Object.keys(spec).length > 0;
            // Map domain names to icons
            const normalizedDomain = domain.toLowerCase();
            let IconComponent = SettingsIcon;
            if (normalizedDomain === 'architecture') IconComponent = ArchitectIcon;
            else if (normalizedDomain === 'design') IconComponent = DesignerIcon;
            else if (normalizedDomain === 'model') IconComponent = DatabaseIcon;
            else if (normalizedDomain === 'testing') IconComponent = TesterIcon;
            else if (normalizedDomain === 'security') IconComponent = SecurityIcon;

            return (
              <span
                key={domain}
                className={`p-0.5 transition-opacity ${
                  hasContent
                    ? 'opacity-100 text-text-secondary'
                    : 'opacity-30 text-text-dim'
                }`}
                title={domain.charAt(0).toUpperCase() + domain.slice(1)}
              >
                <IconComponent size="xs" />
              </span>
            );
          })}
        </div>

        {step.scope && (
          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-bg-elevated text-text-secondary rounded">
            {step.scope}
          </span>
        )}

        {onOpenComments && (
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-text-muted hover:text-accent-cyan transition-colors"
            onClick={() => onOpenComments(step.step_id)}
            title={commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add comment'}
          >
            <MessageIcon size="sm" />
            {commentCount > 0 && (
              <span className="text-xs font-medium text-accent-cyan">{commentCount}</span>
            )}
          </button>
        )}

        {saving && (
          <span className="flex-shrink-0 text-xs text-accent-cyan animate-pulse">Saving...</span>
        )}

        {!disabled && (
          <div className="flex-shrink-0 flex items-center gap-1">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-error text-white font-medium rounded transition-all duration-150 hover:shadow-[0_0_10px_rgba(255,71,87,0.3)]"
                  onClick={handleDelete}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-bg-elevated text-text-secondary font-medium rounded transition-colors hover:text-text-primary"
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="p-1 text-text-muted hover:text-error transition-colors"
                onClick={handleDelete}
                title="Delete step"
              >
                <TrashIcon size="sm" />
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-4 border-t border-border-subtle">
          <StepSpecificationTabs
            step={step}
            isEditable={isEditable}
            onSpecUpdate={handleSpecUpdate}
            detailsContent={
              <>
                {/* Description */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                    Description
                  </label>
                  <EditableTextarea
                    value={step.description || ''}
                    onSave={(value) => handleUpdate('description', value)}
                    placeholder="Describe what needs to be done..."
                    disabled={!isEditable}
                    rows={3}
                  />
                </div>

                {/* Scope & Owner Role - side by side */}
                <div className="grid grid-cols-2 gap-6 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                      Scope
                    </label>
                    <EditableText
                      value={step.scope || ''}
                      onSave={(value) => handleUpdate('scope', value)}
                      placeholder="e.g., api-service, frontend"
                      disabled={!isEditable}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                      Owner Role
                    </label>
                    <OwnerRoleSelector
                      value={step.owner_role || ''}
                      onChange={(value) => handleUpdate('owner_role', value)}
                      disabled={!isEditable}
                    />
                  </div>
                </div>

                {/* Dependencies */}
                <DependenciesSection
                  step={step}
                  allSteps={allSteps}
                  onUpdate={onUpdate}
                  disabled={!isEditable}
                />

                {/* Acceptance Criteria */}
                <AcceptanceCriteriaSection
                  step={step}
                  onUpdate={onUpdate}
                  disabled={!isEditable}
                />

                {/* Gate */}
                <ApprovalGateSection
                  step={step}
                  onUpdate={onUpdate}
                  disabled={!isEditable}
                />
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

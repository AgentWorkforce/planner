import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TreeBreadcrumb } from './TreeBreadcrumb';
import { WorkSection } from './WorkSection';
import { SheetContainer } from '../sheets/SheetContainer';
import { StepSheet } from '../sheets/StepSheet';
import {
  orderScopes,
  topologicalSort,
  orderStepsWithStatusOverlay,
} from '@/utils/tree-ordering';

export type ZoomLevel = 'overview' | 'scope' | 'step';

export interface TreeStep {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  execution_status?: 'pending' | 'running' | 'done' | 'blocked' | 'failed';
  source_block_id?: string;
  /** Signal provenance — links step back to cultivate signals (future) */
  provenance?: Array<{ signal_id: string; source: string; created_at: string }>;
  created_at?: string;
  metadata?: Record<string, unknown>;
  acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
}

/**
 * Maps scope names to workspace paths for display
 * Convention: scope name corresponds to packages/{scope}/
 */
function getScopeWorkspacePath(scope: string): string | null {
  if (!scope || scope === 'default') return null;
  return `packages/${scope}/`;
}

export interface ProjectTreeProps {
  steps: TreeStep[];
  projectName?: string;
  className?: string;
  onStepUpdate?: (stepId: string, updates: Partial<TreeStep>) => Promise<void>;
  onSendMessage?: (message: string, stepContext: { step_id: string; title: string }) => void;
}

/**
 * ProjectTree - Zoomable project work tree organized by scope
 *
 * Manages three zoom levels:
 * - OVERVIEW: All scopes collapsed, showing scope headers only
 * - SCOPE: One scope expanded showing all steps
 * - STEP: One step focused (highlight only, detail deferred to sheets)
 *
 * URL params:
 * - ?zoom=overview|scope|step
 * - &focus=scope-id or scope-id.step-id
 *
 * Features:
 * - Breadcrumb navigation at top
 * - Scope grouping with progress bars
 * - Compact step nodes with status indicators
 * - Click handlers for zoom transitions
 */
export function ProjectTree({ steps, projectName = 'Project', className, onStepUpdate, onSendMessage }: ProjectTreeProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const zoom = (searchParams.get('zoom') || 'overview') as ZoomLevel;
  const focus = searchParams.get('focus') || '';

  // Parse focus string: "scope-id" or "scope-id.step-id"
  const [focusedScope, focusedStep] = focus.split('.');

  // Group steps by scope and apply topological sorting + status overlay
  const scopedSteps = steps.reduce((acc, step) => {
    const scope = step.scope || 'default';
    if (!acc[scope]) {
      acc[scope] = [];
    }
    acc[scope].push(step);
    return acc;
  }, {} as Record<string, TreeStep[]>);

  // Apply ordering to each scope's steps: topological sort, then status overlay
  const orderedScopedSteps = Object.entries(scopedSteps).reduce((acc, [scope, scopeSteps]) => {
    const topoSorted = topologicalSort(scopeSteps);
    const withStatusOverlay = orderStepsWithStatusOverlay(topoSorted);
    acc[scope] = withStatusOverlay;
    return acc;
  }, {} as Record<string, TreeStep[]>);

  // Order scopes by activity level
  const scopes = orderScopes(orderedScopedSteps);

  const handleZoomChange = useCallback(
    (newZoom: ZoomLevel, newFocus?: string) => {
      const params = new URLSearchParams();
      params.set('zoom', newZoom);
      if (newFocus) {
        params.set('focus', newFocus);
      }
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const handleScopeClick = useCallback(
    (scopeId: string) => {
      if (zoom === 'overview') {
        // Expand scope
        handleZoomChange('scope', scopeId);
      } else if (zoom === 'scope' && focusedScope === scopeId) {
        // Collapse back to overview
        handleZoomChange('overview');
      } else {
        // Switch to different scope
        handleZoomChange('scope', scopeId);
      }
    },
    [zoom, focusedScope, handleZoomChange]
  );

  const handleStepClick = useCallback(
    (scopeId: string, stepId: string) => {
      const focusKey = `${scopeId}.${stepId}`;
      const currentFocus = searchParams.get('focus');
      const currentZoom = searchParams.get('zoom');

      if (currentZoom === 'step' && currentFocus === focusKey) {
        // Already focused on this step - open sheet
        setSheetOpen(true);
      } else {
        // First click - just zoom to step
        handleZoomChange('step', focusKey);
      }
    },
    [handleZoomChange, searchParams]
  );

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
    // Keep zoom at STEP level when closing sheet
  }, []);

  const handleBreadcrumbClick = useCallback(
    (level: 'project' | 'scope' | 'step') => {
      if (level === 'project') {
        handleZoomChange('overview');
      } else if (level === 'scope') {
        handleZoomChange('scope', focusedScope);
      }
      // If level === 'step', do nothing (already at step)
    },
    [handleZoomChange, focusedScope]
  );

  // Determine breadcrumb data
  const breadcrumbSegments: Array<{ label: string; level: 'project' | 'scope' | 'step'; active: boolean }> = [
    { label: projectName, level: 'project', active: zoom === 'overview' },
  ];

  if (zoom === 'scope' || zoom === 'step') {
    breadcrumbSegments.push({
      label: focusedScope || 'Unknown Scope',
      level: 'scope',
      active: zoom === 'scope',
    });
  }

  if (zoom === 'step' && focusedStep) {
    const step = steps.find((s) => s.step_id === focusedStep);
    breadcrumbSegments.push({
      label: step?.title || 'Unknown Step',
      level: 'step',
      active: true,
    });
  }

  // Find the currently selected step for the sheet
  const selectedStep = focusedStep ? steps.find((s) => s.step_id === focusedStep) : undefined;

  return (
    <>
      <div className={cn('flex flex-col h-full overflow-hidden', className)}>
        {/* Breadcrumb */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-border-subtle">
          <TreeBreadcrumb segments={breadcrumbSegments} onSegmentClick={handleBreadcrumbClick} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {zoom === 'overview' && (
            <div className="space-y-2">
              {scopes.map((scope) => (
                <WorkSection
                  key={scope}
                  scope={scope}
                  steps={orderedScopedSteps[scope] || []}
                  isExpanded={false}
                  workspacePath={getScopeWorkspacePath(scope)}
                  onScopeClick={() => handleScopeClick(scope)}
                  onStepClick={(stepId) => handleStepClick(scope, stepId)}
                />
              ))}
            </div>
          )}

          {zoom === 'scope' && focusedScope && (
            <div>
              <WorkSection
                scope={focusedScope}
                steps={orderedScopedSteps[focusedScope] || []}
                isExpanded={true}
                workspacePath={getScopeWorkspacePath(focusedScope)}
                onScopeClick={() => handleScopeClick(focusedScope)}
                onStepClick={(stepId) => handleStepClick(focusedScope, stepId)}
              />
            </div>
          )}

          {zoom === 'step' && focusedStep && focusedScope && (
            <div>
              <WorkSection
                scope={focusedScope}
                steps={orderedScopedSteps[focusedScope] || []}
                isExpanded={true}
                workspacePath={getScopeWorkspacePath(focusedScope)}
                selectedStepId={focusedStep}
                focusedStepId={focusedStep}
                sheetOpen={sheetOpen}
                onScopeClick={() => handleScopeClick(focusedScope)}
                onStepClick={(stepId) => handleStepClick(focusedScope, stepId)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Step detail sheet */}
      {selectedStep && (
        <SheetContainer
          isOpen={sheetOpen}
          onClose={handleCloseSheet}
          title="Step Details"
        >
          <StepSheet
            step={selectedStep}
            onUpdate={onStepUpdate}
            onSendMessage={onSendMessage}
          />
        </SheetContainer>
      )}
    </>
  );
}

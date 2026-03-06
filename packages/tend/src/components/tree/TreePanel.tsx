import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWorkingChanges } from '@/hooks/useWorkingChanges';
import { ProjectTree } from './ProjectTree';
import { ChangesetTree } from './ChangesetTree';
import { TreeModeSwitch } from './TreeModeSwitch';
import type { ProjectTreeProps } from './ProjectTree';
import type { RunMetrics } from '@/hooks/useBuildMonitor';

const BranchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 opacity-60">
    <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
  </svg>
);

/**
 * TreePanel wraps ProjectTree with a mode switcher between plan view and
 * changeset view. It passes all ProjectTree props through unchanged so that
 * plan mode behaves identically to using ProjectTree directly.
 *
 * URL state:
 *   ?tree=changes  — force changeset mode
 *   (absent)       — plan mode when steps exist, changeset mode otherwise
 *
 * When switching to changes mode the plan-specific params (zoom, focus) are
 * cleared. When switching back to plan mode the changes-specific param
 * (expand) is cleared.
 */
interface TreePanelProps extends ProjectTreeProps {
  onStartBuild?: () => void;
  planStatus?: string;
  /** Current build status when a run is active */
  buildStatus?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | null;
  /** Cancel the current build */
  onCancelBuild?: () => void;
  /** Run-level aggregate metrics from forge-next */
  runMetrics?: RunMetrics | null;
  /** Step names with active stall warnings */
  stallWarnings?: string[];
}

export function TreePanel({
  steps,
  projectName = 'Project',
  className,
  onStepUpdate,
  onSendMessage,
  onStartBuild,
  planStatus,
  buildStatus,
  onCancelBuild,
  runMetrics,
  stallWarnings = [],
}: TreePanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { totalChanges, branch, detachedHead } = useWorkingChanges();
  const branchLabel = branch ?? detachedHead ?? null;

  const planAvailable = steps.length > 0;
  const autoMode: 'plan' | 'changes' = planAvailable ? 'plan' : 'changes';
  const urlMode = searchParams.get('tree') as 'plan' | 'changes' | null;
  const effectiveMode: 'plan' | 'changes' =
    urlMode === 'plan' || urlMode === 'changes' ? urlMode : autoMode;

  const handleModeChange = (newMode: 'plan' | 'changes') => {
    const next = new URLSearchParams(searchParams);
    if (newMode === 'changes') {
      next.set('tree', 'changes');
      next.delete('zoom');
      next.delete('focus');
    } else {
      next.delete('tree'); // plan is the default when steps exist
      next.delete('expand');
    }
    setSearchParams(next, { replace: true });
  };

  // Branch header used in changes mode — shows git branch icon + name
  const branchHeader = (
    <span className="flex items-center gap-1.5 text-xs text-text-muted font-mono truncate">
      <BranchIcon />
      {branchLabel ?? '???'}
    </span>
  );

  // When there are no plan steps, show branch header + ChangesetTree.
  if (!planAvailable) {
    return (
      <div className={cn('flex flex-col h-full overflow-hidden', className)}>
        <div className="flex-shrink-0 flex items-center justify-between pl-[11px] pr-4 h-9 border-b border-border-subtle bg-[var(--color-bg-chrome)]">
          {branchHeader}
        </div>
        <div className="flex-1 min-h-0">
          <ChangesetTree />
        </div>
      </div>
    );
  }

  // In plan mode, ProjectTree renders its own breadcrumb header — just pass
  // through and overlay the mode toggle in its header bar.
  if (effectiveMode === 'plan') {
    return (
      <div className={cn('relative flex flex-col h-full', className)}>
        {/* Controls floated into ProjectTree's header area */}
        <div className="absolute top-0 right-3 h-9 flex items-center gap-2 z-10">
          {planStatus === 'published' && onStartBuild && (
            <button
              type="button"
              onClick={onStartBuild}
              className="px-3 py-1 text-xs font-medium bg-accent-cyan text-bg-deep rounded-md hover:shadow-glow-cyan transition-all"
            >
              Start Build
            </button>
          )}
          <TreeModeSwitch
            mode={effectiveMode}
            onModeChange={handleModeChange}
            planAvailable={planAvailable}
            changeCount={totalChanges}
          />
        </div>
        {/* Build status banner — shown below the header when a run is active */}
        {buildStatus && (
          <div className={cn(
            'flex-shrink-0 border-b',
            buildStatus === 'running' && 'bg-accent-cyan/10 border-accent-cyan/20',
            buildStatus === 'paused' && 'bg-amber-500/10 border-amber-500/20',
            buildStatus === 'completed' && 'bg-emerald-500/10 border-emerald-500/20',
            buildStatus === 'failed' && 'bg-red-500/10 border-red-500/20',
            buildStatus === 'cancelled' && 'bg-text-muted/10 border-border-subtle',
            buildStatus === 'pending' && 'bg-text-muted/10 border-border-subtle',
          )}>
            {/* Status row */}
            <div className={cn(
              'flex items-center justify-between px-3 py-1.5 text-xs font-medium',
              buildStatus === 'running' && 'text-accent-cyan',
              buildStatus === 'paused' && 'text-amber-400',
              buildStatus === 'completed' && 'text-emerald-400',
              buildStatus === 'failed' && 'text-red-400',
              (buildStatus === 'cancelled' || buildStatus === 'pending') && 'text-text-muted',
            )}>
              <span className="flex items-center gap-1.5">
                {buildStatus === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />}
                {buildStatus === 'paused' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                {buildStatus === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {buildStatus === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                Build {buildStatus}
              </span>
              {(buildStatus === 'running' || buildStatus === 'paused') && onCancelBuild && (
                <button
                  type="button"
                  onClick={onCancelBuild}
                  className="px-2 py-0.5 text-xs text-text-muted hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            {/* Run metrics row — shown when aggregate data is available */}
            {runMetrics && (
              <div className="flex flex-wrap gap-3 px-3 pb-1.5 text-xs text-text-muted">
                <span>{runMetrics.stepsCompleted}/{runMetrics.stepsTotal} steps</span>
                {runMetrics.avgSatisfaction > 0 && (
                  <span>Satisfaction: {Math.round(runMetrics.avgSatisfaction)}/100</span>
                )}
                {runMetrics.totalCostUsd > 0 && (
                  <span>Cost: ${runMetrics.totalCostUsd.toFixed(3)}</span>
                )}
                {stallWarnings.length > 0 && (
                  <span className="text-amber-400">{stallWarnings.length} stalled</span>
                )}
              </div>
            )}
          </div>
        )}
        {/* Escalation summary banner — shown when any step needs attention */}
        {steps.some((s) => s.escalation) && (
          <div className="flex-shrink-0 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-amber-400 text-xs">⚡</span>
              <span className="text-xs font-medium text-amber-400">
                {steps.filter((s) => s.escalation).length} step{steps.filter((s) => s.escalation).length !== 1 ? 's' : ''} need attention
              </span>
            </div>
            <ul className="space-y-0.5">
              {steps.filter((s) => s.escalation).map((s) => (
                <li key={s.step_id} className="text-xs text-text-muted flex items-center gap-1.5">
                  <span className="flex-shrink-0 text-amber-400/60">·</span>
                  <span className="truncate">{s.title}</span>
                  <span className="flex-shrink-0 text-amber-400/60">({s.escalation!.type})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ProjectTree
          steps={steps}
          projectName={projectName}
          onStepUpdate={onStepUpdate}
          onSendMessage={onSendMessage}
        />
      </div>
    );
  }

  // Changes mode (plan exists): render branch header + mode toggle + ChangesetTree
  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      <div className="flex-shrink-0 flex items-center justify-between pl-[11px] pr-4 h-9 border-b border-border-subtle bg-[var(--color-bg-chrome)]">
        {branchHeader}
        <TreeModeSwitch
          mode={effectiveMode}
          onModeChange={handleModeChange}
          planAvailable={planAvailable}
          changeCount={totalChanges}
        />
      </div>
      <div className="flex-1 min-h-0">
        <ChangesetTree />
      </div>
    </div>
  );
}

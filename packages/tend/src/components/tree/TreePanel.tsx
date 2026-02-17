import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWorkingChanges } from '@/hooks/useWorkingChanges';
import { ProjectTree } from './ProjectTree';
import { ChangesetTree } from './ChangesetTree';
import { TreeModeSwitch } from './TreeModeSwitch';
import type { ProjectTreeProps } from './ProjectTree';

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
export function TreePanel({
  steps,
  projectName = 'Project',
  className,
  onStepUpdate,
  onSendMessage,
}: ProjectTreeProps) {
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
        {/* Mode toggle floated into ProjectTree's header area */}
        <div className="absolute top-0 right-3 h-9 flex items-center z-10">
          <TreeModeSwitch
            mode={effectiveMode}
            onModeChange={handleModeChange}
            planAvailable={planAvailable}
            changeCount={totalChanges}
          />
        </div>
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

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlanEditor } from '@/contexts/PlanEditorContext';
import { listVersions } from '@/api';
import { cn } from '@/lib/utils';
import { PlanBreadcrumb } from '@/components/PlanBreadcrumb';
import { EditableTextarea } from '@/components/EditableTextarea';
import { WorkflowActions } from '@/components/WorkflowActions';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DocumentIcon, DecisionsIcon, BrainIcon, SettingsIcon, PlusIcon, ChevronLeftIcon } from '@/components/icons';

interface PlanEditorHeaderProps {
  activeTab: 'plan' | 'understanding' | 'context' | 'decisions';
}

export function PlanEditorHeader({ activeTab }: PlanEditorHeaderProps) {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const {
    version,
    parents,
    handleGoalUpdate,
    handleContextUpdate,
    handleWorkflowSubmit,
    handleWorkflowApprove,
    handleWorkflowPublish,
    handleStartBuild,
    switchVersion,
  } = usePlanEditor();

  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [versionList, setVersionList] = useState<{ version: number; status: string }[]>([]);

  if (!version) return null;

  const handleVersionClick = async () => {
    if (!planId) return;
    try {
      const result = await listVersions(planId);
      setVersionList(
        result.versions
          .map((v) => ({ version: v.version, status: v.status }))
          .reverse()
      );
      setVersionPickerOpen(true);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  };

  const handleVersionSelect = async (versionNumber: number) => {
    setVersionPickerOpen(false);
    await switchVersion(versionNumber);
  };

  return (
    <div className="border-b border-border-subtle">
      {/* Row 1: Back + Action */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border-subtle">
        <Link
          to="/plans"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeftIcon size="sm" />
          Back to plans
        </Link>
        <Button asChild variant="primary" size="sm">
          <Link to="/plans/new">
            <PlusIcon size="sm" />
            New Plan
          </Link>
        </Button>
      </div>

      {/* Row 2: Tab toggle */}
      <div className="flex items-center h-12 px-4 border-b border-border-subtle">
        <ToggleGroup
          type="single"
          value={activeTab}
          onValueChange={(value) => {
            if (value === 'plan') {
              navigate(`/plans/${planId}`);
            } else if (value === 'understanding') {
              navigate(`/plans/${planId}/understanding`);
            } else if (value === 'context') {
              navigate(`/plans/${planId}/context`);
            } else if (value === 'decisions') {
              navigate(`/plans/${planId}/decisions`);
            }
          }}
          className="h-8 p-0.5 bg-bg-tertiary rounded-lg"
        >
          <ToggleGroupItem value="plan" aria-label="Plan view" className="h-7">
            <DocumentIcon size="sm" />
            Plan
          </ToggleGroupItem>
          <ToggleGroupItem value="understanding" aria-label="Understanding view" className="h-7">
            <BrainIcon size="sm" />
            Understanding
          </ToggleGroupItem>
          <ToggleGroupItem value="context" aria-label="Context view" className="h-7">
            <SettingsIcon size="sm" />
            Context
          </ToggleGroupItem>
          <ToggleGroupItem value="decisions" aria-label="Decisions view" className="h-7">
            <DecisionsIcon size="sm" />
            Decisions
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="px-6 py-4 bg-bg-card">
        {/* Breadcrumb row */}
        <PlanBreadcrumb parents={parents} currentGoal={version.summary.goal} />

        {/* Main header: 2-column layout */}
        <div className="mt-4 flex gap-8">
          {/* Left column: Title and metadata */}
          <div className="flex-1 min-w-0">
            <EditableTextarea
              value={version.summary.goal || ''}
              onSave={handleGoalUpdate}
              placeholder="Enter plan goal..."
              disabled={version.status !== 'draft'}
              rows={1}
              className="text-2xl font-semibold text-text-primary"
            />
            <div className="mt-2">
              <EditableTextarea
                value={version.summary.context || ''}
                onSave={handleContextUpdate}
                placeholder="Add context or background for this plan..."
                disabled={version.status !== 'draft'}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
              <div className="relative">
                <span
                  className="cursor-pointer"
                  onClick={handleVersionClick}
                >
                  Version {version.version}
                </span>
                {versionPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setVersionPickerOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] max-h-[240px] overflow-y-auto bg-bg-card border border-border-subtle rounded-md shadow-lg py-1">
                      {versionList.map((v) => (
                        <div
                          key={v.version}
                          className={cn(
                            'px-3 py-1.5 text-sm cursor-pointer transition-colors flex items-center justify-between gap-3',
                            v.version === version.version
                              ? 'text-text-primary bg-bg-tertiary'
                              : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                          )}
                          onClick={() => handleVersionSelect(v.version)}
                        >
                          <span>Version {v.version}</span>
                          <span className="text-xs text-text-muted">{v.status}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {version.submitted_at && (
                <>
                  <span className="text-text-dim">•</span>
                  <span>Submitted for review</span>
                </>
              )}
            </div>
          </div>

          {/* Right column: Status and actions */}
          <div className="flex-shrink-0 w-72">
            <WorkflowActions
              version={version}
              onSubmit={handleWorkflowSubmit}
              onApprove={handleWorkflowApprove}
              onPublish={handleWorkflowPublish}
              onStartBuild={handleStartBuild}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlanEditor } from '@/contexts/PlanEditorContext';
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
  } = usePlanEditor();

  if (!version) return null;

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
              <span>Version {version.version}</span>
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}

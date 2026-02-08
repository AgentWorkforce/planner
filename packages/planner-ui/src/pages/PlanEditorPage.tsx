import { Link, useLocation } from 'react-router-dom';
import { PlanEditorProvider, usePlanEditor } from '@/contexts/PlanEditorContext';
import { PlanEditorHeader } from '@/components/plan-editor/PlanEditorHeader';
import { PlanTabContent } from '@/components/plan-editor/PlanTabContent';
import { DecisionsTabContent } from '@/components/plan-editor/DecisionsTabContent';
import { UnderstandingTab } from '@/components/UnderstandingTab';
import { ContextTab } from '@/components/ContextTab';
import { CommentThread } from '@/components/CommentThread';
import { MessagingSidebar } from '@/components/MessagingSidebar';
import { LoadingSpinner } from '@/components/LoadingSpinner';

function PlanEditorContent() {
  const location = useLocation();
  const {
    plan,
    version,
    loading,
    error,
    sidebarCollapsed,
    handleSidebarCollapseChange,
    selectedStep,
    activePanel,
    commentStep,
    closeActivePanel,
    handleAddComment,
    handleResolveComment,
    handleUnresolveComment,
    getStepComments,
    currentUser,
  } = usePlanEditor();

  // Active tab detection based on URL
  const activeTab = location.pathname.endsWith('/decisions')
    ? 'decisions'
    : location.pathname.endsWith('/understanding')
      ? 'understanding'
      : location.pathname.endsWith('/context')
        ? 'context'
        : 'plan';

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <LoadingSpinner message="Loading plan..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-error">
          {error}
        </div>
        <Link
          to="/plans"
          className="inline-flex px-4 py-2 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-bg-hover transition-colors"
        >
          Back to Plans
        </Link>
      </div>
    );
  }

  if (!plan || !version) {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-error">
          Plan not found
        </div>
        <Link
          to="/plans"
          className="inline-flex px-4 py-2 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-bg-hover transition-colors"
        >
          Back to Plans
        </Link>
      </div>
    );
  }

  // Plan context for messaging sidebar
  const planContext = {
    planId: plan.plan_id,
    planTitle: version.summary.goal || 'Untitled Plan',
    stepId: selectedStep?.step_id,
    stepTitle: selectedStep?.title,
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main content area - higher z-index so popovers appear above sidebar */}
      <div className="flex-1 min-w-0 overflow-y-auto relative z-10">
        {/* Header */}
        <PlanEditorHeader activeTab={activeTab} />

        {/* Content - conditionally render based on active tab */}
        {activeTab === 'plan' && <PlanTabContent />}

        {/* Understanding tab content */}
        {activeTab === 'understanding' && (
          <div className="px-6 py-6 space-y-6 overflow-auto">
            <UnderstandingTab
              understanding={version.understanding}
              isEditable={version.status === 'draft'}
            />
          </div>
        )}

        {/* Context tab content */}
        {activeTab === 'context' && (
          <div className="px-6 py-6 space-y-6 overflow-auto">
            <ContextTab
              planId={plan.plan_id}
              context={version.context}
              isEditable={version.status === 'draft'}
              onContextUpdate={() => {
                // This updates the version directly via the ContextTab's internal logic
                // The context already handles version updates via the API
              }}
            />
          </div>
        )}

        {/* Decisions tab content */}
        {activeTab === 'decisions' && <DecisionsTabContent />}

        {/* Comment Thread Panel */}
        {activePanel === 'comments' && commentStep && (
          <CommentThread
            step={commentStep}
            comments={getStepComments(commentStep.step_id)}
            currentUser={currentUser?.name || 'User'}
            onAddComment={handleAddComment}
            onResolve={handleResolveComment}
            onUnresolve={handleUnresolveComment}
            onClose={closeActivePanel}
          />
        )}
      </div>

      {/* Messaging Sidebar */}
      <MessagingSidebar
        planContext={planContext}
        isCollapsed={sidebarCollapsed}
        onCollapseChange={handleSidebarCollapseChange}
      />
    </div>
  );
}

export function PlanEditorPage() {
  return (
    <PlanEditorProvider>
      <PlanEditorContent />
    </PlanEditorProvider>
  );
}

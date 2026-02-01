import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getPlan, updatePlan, ApiError, getComments, createComment, resolveComment, unresolveComment, submitVersion, approveVersion, publishVersion } from '@/api';
import type { Plan, PlanVersion, ParentPlanInfo, SubPlanNavigationState, Step, Comment } from '@/types';
import { PlanBreadcrumb } from '@/components/PlanBreadcrumb';
import { StepEditor } from '@/components/StepEditor';
import { EditableText } from '@/components/EditableText';
import { EditableTextarea } from '@/components/EditableTextarea';
import { CommentThread } from '@/components/CommentThread';
import { WorkflowActions } from '@/components/WorkflowActions';
import { SwimlaneView } from '@/components/SwimlaneView';
import { ViewModeToggle, type ViewMode } from '@/components/ViewModeToggle';
import { DependencyLinesOverlay } from '@/components/DependencyLinesOverlay';
import { MessagingSidebar } from '@/components/MessagingSidebar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DocumentIcon, DecisionsIcon, PlusIcon, ChevronLeftIcon } from '@/components/icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePlanEvents } from '@/hooks';
import { useUserTrajectory } from '@/hooks/useUserTrajectory';
import { DecisionLogHeader } from '@/components/trajectory/DecisionLogHeader';
import { DecisionList } from '@/components/trajectory/DecisionList';
import { DecisionEmptyState } from '@/components/trajectory/DecisionEmptyState';
import { DecisionDetailSheet } from '@/components/trajectory/DecisionDetailSheet';
import { PreferencesSummary } from '@/components/trajectory/PreferencesSummary';

/** Panel type for comments */
type ActivePanel = 'comments' | null;

/** Storage key for sidebar collapsed state */
const SIDEBAR_COLLAPSED_KEY = 'planner-sidebar-collapsed';

export function PlanEditorPage() {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Messaging sidebar collapsed state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  });

  // Persist sidebar collapsed state
  const handleSidebarCollapseChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, []);

  // Get parent chain from navigation state
  const navState = location.state as SubPlanNavigationState | null;
  const parents: ParentPlanInfo[] = navState?.parents || [];

  // Track selected step for contextual chat prompts
  const [selectedStep, setSelectedStep] = useState<Step | undefined>(undefined);

  // Track which step is expanded for editing
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // Panel coexistence: only one panel can be open at a time
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Comment state
  const [commentStepId, setCommentStepId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  // View mode state (list vs swimlane)
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [hoveredDirection, setHoveredDirection] = useState<'incoming' | 'outgoing' | null>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // Active tab detection based on URL
  const activeTab = location.pathname.endsWith('/decisions') ? 'decisions' : 'plan';

  // Decision-related state (for decisions tab)
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [decisionSheetOpen, setDecisionSheetOpen] = useState(false);

  // Fetch trajectory data for decisions tab
  const { decisions, preferences, isLoading: decisionsLoading, error: decisionsError } = useUserTrajectory(planId || null);

  // Extract unique agent roles from decisions
  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    decisions.forEach((decision) => {
      if (decision.asking_agent) {
        agents.add(decision.asking_agent);
      }
    });
    return Array.from(agents).sort();
  }, [decisions]);

  // Filter decisions by agent
  const filteredDecisions = useMemo(() => {
    if (agentFilter === 'all') {
      return decisions;
    }
    return decisions.filter((decision) => decision.asking_agent === agentFilter);
  }, [decisions, agentFilter]);

  // Get selected decision object
  const selectedDecision = useMemo(() => {
    if (!selectedDecisionId) return null;
    return decisions.find((d) => d.event_id === selectedDecisionId) || null;
  }, [decisions, selectedDecisionId]);

  // Handle decision row click
  const handleDecisionSelect = (eventId: string) => {
    setSelectedDecisionId(eventId);
    setDecisionSheetOpen(true);
  };

  // Handle decision sheet close
  const handleDecisionSheetClose = () => {
    setDecisionSheetOpen(false);
  };

  // Scroll to and highlight a step (used by dependency indicator click)
  const handleScrollToStep = useCallback((stepId: string) => {
    const container = stepsContainerRef.current;
    if (!container) return;

    const stepElement = container.querySelector(`[data-step-id="${stepId}"]`);
    if (stepElement) {
      stepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Temporarily highlight the step
      setHoveredStepId(stepId);
      setTimeout(() => setHoveredStepId(null), 2000);
    }
  }, []);

  // Debounced refetch plan data (used by real-time sync)
  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchPlan = useCallback(async () => {
    if (!planId) return;
    try {
      const result = await getPlan(planId);
      // Only update if fetched version is newer than local
      setVersion((prev) => {
        if (!prev || result.version.version > prev.version) {
          return result.version;
        }
        return prev;
      });
      setPlan(result.plan);
    } catch (err) {
      console.error('[PlanEditorPage] Failed to refetch plan:', err);
    }
  }, [planId]);

  // Debounced event handler (300ms) to coalesce rapid events
  const handlePlanEvent = useCallback(() => {
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    refetchTimeoutRef.current = setTimeout(() => {
      refetchPlan();
      refetchTimeoutRef.current = null;
    }, 300);
  }, [refetchPlan]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, []);

  // Real-time sync: Subscribe to plan changes (always enabled since PlannerLead is persistent)
  const { isConnected: isEventStreamConnected, error: eventStreamError } = usePlanEvents(
    planId ?? null,
    true, // Always subscribe - PlannerLead may update plans at any time
    handlePlanEvent
  );

  // Log event stream status for debugging (isEventStreamConnected used in log)
  useEffect(() => {
    if (eventStreamError) {
      console.warn('[PlanEditorPage] Event stream error:', eventStreamError);
    }
    if (isEventStreamConnected) {
      console.debug('[PlanEditorPage] Event stream connected for real-time plan updates');
    }
  }, [eventStreamError, isEventStreamConnected]);

  // Fetch plan on mount
  useEffect(() => {
    async function fetchPlan() {
      if (!planId) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getPlan(planId);
        setPlan(result.plan);
        setVersion(result.version);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load plan');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [planId]);

  // Fetch comments when plan/version loads
  useEffect(() => {
    async function fetchComments() {
      if (!planId || !version) return;

      try {
        const result = await getComments(planId, version.version);
        setComments(result.comments);
      } catch (err) {
        console.error('Failed to load comments:', err);
        // Don't set error state - comments are not critical
      }
    }

    fetchComments();
  }, [planId, version?.version]);

  // Handler for updating a step
  const handleStepUpdate = useCallback(
    async (stepId: string, updates: Partial<Step>) => {
      if (!planId || !version) return;

      // Create updated steps array
      const updatedSteps = version.steps.map((step) =>
        step.step_id === stepId ? { ...step, ...updates } : step
      );

      // Call API and update local state
      const result = await updatePlan(planId, { steps: updatedSteps });
      setVersion(result.version);
    },
    [planId, version]
  );

  // Handler for deleting a step
  const handleStepDelete = useCallback(
    async (stepId: string) => {
      if (!planId || !version) return;

      // Remove step from array
      const updatedSteps = version.steps.filter((step) => step.step_id !== stepId);

      // Also remove this step from other steps' dependencies
      const cleanedSteps = updatedSteps.map((step) => ({
        ...step,
        dependencies: step.dependencies.filter((depId) => depId !== stepId),
      }));

      // Call API and update local state
      const result = await updatePlan(planId, { steps: cleanedSteps });
      setVersion(result.version);

      // Clear selection if deleted step was selected
      if (selectedStep?.step_id === stepId) {
        setSelectedStep(undefined);
      }
      if (expandedStepId === stepId) {
        setExpandedStepId(null);
      }
      // Close comment panel if viewing comments for deleted step
      if (commentStepId === stepId) {
        setActivePanel(null);
        setCommentStepId(null);
      }
    },
    [planId, version, selectedStep, expandedStepId, commentStepId]
  );

  // Panel handlers
  const openCommentsPanel = useCallback((stepId: string) => {
    setCommentStepId(stepId);
    setActivePanel('comments');
  }, []);

  const closeActivePanel = useCallback(() => {
    setActivePanel(null);
    setCommentStepId(null);
  }, []);

  // Comment handlers
  const handleAddComment = useCallback(
    async (stepId: string, content: string, parentId?: string) => {
      if (!planId || !version) return;

      const result = await createComment(planId, version.version, stepId, content, parentId);
      setComments((prev) => [...prev, result.comment]);
    },
    [planId, version]
  );

  const handleResolveComment = useCallback(
    async (commentId: string) => {
      if (!planId || !version) return;

      const result = await resolveComment(planId, version.version, commentId);
      setComments((prev) =>
        prev.map((c) => (c.comment_id === commentId ? result.comment : c))
      );
    },
    [planId, version]
  );

  const handleUnresolveComment = useCallback(
    async (commentId: string) => {
      if (!planId || !version) return;

      const result = await unresolveComment(planId, version.version, commentId);
      setComments((prev) =>
        prev.map((c) => (c.comment_id === commentId ? result.comment : c))
      );
    },
    [planId, version]
  );

  // Workflow handlers for submit/approve/publish transitions
  const handleWorkflowSubmit = useCallback(async () => {
    if (!planId || !version) return;
    const result = await submitVersion(planId, version.version);
    setVersion(result.version);
  }, [planId, version]);

  const handleWorkflowApprove = useCallback(async (approver: string) => {
    if (!planId || !version) return;
    const result = await approveVersion(planId, version.version, approver);
    setVersion(result.version);
  }, [planId, version]);

  const handleWorkflowPublish = useCallback(async () => {
    if (!planId || !version) return;
    const result = await publishVersion(planId, version.version);
    setVersion(result.version);
  }, [planId, version]);

  // Handler for updating the plan goal (title)
  const handleGoalUpdate = useCallback(
    async (newGoal: string) => {
      if (!planId || !version) return;
      const result = await updatePlan(planId, { goal: newGoal });
      setVersion(result.version);
    },
    [planId, version]
  );

  // Handler for updating the plan context
  const handleContextUpdate = useCallback(
    async (newContext: string) => {
      if (!planId || !version) return;
      const result = await updatePlan(planId, { context: newContext });
      setVersion(result.version);
    },
    [planId, version]
  );

  // Get comments for a specific step
  const getStepComments = useCallback(
    (stepId: string): Comment[] => {
      return comments.filter((c) => c.step_id === stepId);
    },
    [comments]
  );

  // Get unresolved comment count for a step
  const getUnresolvedCount = useCallback(
    (stepId: string): number => {
      return comments.filter((c) => c.step_id === stepId && !c.resolved).length;
    },
    [comments]
  );

  // Get the step for the comment panel
  const commentStep = commentStepId
    ? version?.steps.find((s) => s.step_id === commentStepId)
    : null;

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

      {/* Content - conditionally render Plan or Decisions based on active tab */}
      {activeTab === 'plan' ? (
        <div className="px-6 py-6 space-y-6 overflow-hidden">
          {/* Steps header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              Steps ({version.steps.length})
            </h2>
            {version.steps.length > 0 && (
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            )}
          </div>

          {version.steps.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              No steps yet. Add steps to define the work needed to achieve your goal.
            </div>
          ) : (
            <div ref={stepsContainerRef} className="relative pl-10 pr-10">
              {/* Left/right 40px gutters for dependency lines */}
              {viewMode === 'list' ? (
                <div className="space-y-2">
                  {version.steps.map((step) => {
                    const hasSubPlan = !!step.sub_plan_id;
                    const isExpanded = expandedStepId === step.step_id;
                    const isSelected = selectedStep?.step_id === step.step_id;
                    const isEditable = version.status === 'draft';
                    const unresolvedComments = getUnresolvedCount(step.step_id);

                    // Sub-plan steps render as links
                    if (hasSubPlan) {
                      const newParents: ParentPlanInfo[] = [
                        ...parents,
                        { plan_id: plan.plan_id, goal: version.summary.goal },
                      ];

                      return (
                        <div
                          key={step.step_id}
                          data-step-id={step.step_id}
                          className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden hover:border-border-light transition-colors"
                        >
                          <Link
                            to={`/plans/${step.sub_plan_id}`}
                            className="block p-4"
                            state={{ parents: newParents }}
                            aria-label={`Navigate to sub-plan: ${step.title}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-text-primary">{step.title}</span>
                              {step.scope && (
                                <span className="text-xs px-2 py-0.5 bg-bg-tertiary text-text-muted rounded">
                                  {step.scope}
                                </span>
                              )}
                              <Badge variant="info">Sub-plan</Badge>
                            </div>
                          </Link>
                        </div>
                      );
                    }

                    // Regular steps use StepEditor
                    return (
                      <div
                        key={step.step_id}
                        data-step-id={step.step_id}
                        className={`rounded-lg transition-colors ${
                          isSelected ? 'ring-1 ring-accent-cyan' : ''
                        }`}
                        onClick={(e) => {
                          // Don't toggle selection if clicking interactive elements (buttons, inputs, etc.)
                          const target = e.target as HTMLElement;
                          const isInteractive = target.closest('button, input, select, textarea, a, [role="button"]');
                          if (!isInteractive) {
                            setSelectedStep(isSelected ? undefined : step);
                          }
                        }}
                        onMouseEnter={() => setHoveredStepId(step.step_id)}
                        onMouseLeave={() => setHoveredStepId(null)}
                      >
                        <StepEditor
                          step={step}
                          allSteps={version.steps}
                          onUpdate={handleStepUpdate}
                          onDelete={handleStepDelete}
                          disabled={!isEditable}
                          isExpanded={isExpanded}
                          onToggleExpand={() =>
                            setExpandedStepId(isExpanded ? null : step.step_id)
                          }
                          commentCount={unresolvedComments}
                          onOpenComments={openCommentsPanel}
                          onIndicatorHover={setHoveredDirection}
                          onScrollToStep={handleScrollToStep}
                          isHovered={hoveredStepId === step.step_id}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <SwimlaneView
                  steps={version.steps}
                  onStepClick={(step) => setSelectedStep(step)}
                  selectedStepId={selectedStep?.step_id}
                  hoveredStepId={hoveredStepId ?? undefined}
                  onStepHover={setHoveredStepId}
                  onIndicatorHover={setHoveredDirection}
                  onScrollToStep={handleScrollToStep}
                />
              )}
              {/* Dependency lines only for list view - swimlane has its own cross-scope lines */}
              {viewMode === 'list' && (
                <DependencyLinesOverlay
                  steps={version.steps}
                  containerRef={stepsContainerRef}
                  hoveredStepId={hoveredStepId}
                  hoveredDirection={hoveredDirection}
                  viewMode={viewMode}
                />
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <span>Created: {new Date(version.created_at).toLocaleString()}</span>
            <span>Updated: {new Date(version.updated_at).toLocaleString()}</span>
          </div>
        </div>
      ) : (
        /* Decisions tab content */
        <div className="px-6 py-6 space-y-6 overflow-hidden">
          {/* Header with title and agent filter */}
          <DecisionLogHeader
            count={filteredDecisions.length}
            agents={uniqueAgents}
            selectedAgent={agentFilter}
            onAgentChange={setAgentFilter}
          />

          {/* Main content area */}
          <div>
            {/* Preferences summary (if preferences exist) */}
            {preferences.length > 0 && (
              <div className="mb-4">
                <PreferencesSummary preferences={preferences} />
              </div>
            )}

            {/* Decision list or empty state */}
            {decisionsLoading && decisions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-text-muted text-sm">Loading decisions...</p>
              </div>
            ) : decisionsError ? (
              <div className="py-12 text-center">
                <p className="text-error text-sm">{decisionsError}</p>
              </div>
            ) : filteredDecisions.length > 0 ? (
              <DecisionList
                decisions={filteredDecisions}
                selectedId={selectedDecisionId}
                onSelect={handleDecisionSelect}
              />
            ) : (
              <DecisionEmptyState />
            )}
          </div>

          {/* Decision detail sheet - only render when open */}
          {decisionSheetOpen && (
            <DecisionDetailSheet
              decision={selectedDecision}
              open={decisionSheetOpen}
              onClose={handleDecisionSheetClose}
            />
          )}
        </div>
      )}

      {/* Comment Thread Panel */}
      {activePanel === 'comments' && commentStep && (
        <CommentThread
          step={commentStep}
          comments={getStepComments(commentStep.step_id)}
          currentUser="User" // TODO: Get from auth context
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

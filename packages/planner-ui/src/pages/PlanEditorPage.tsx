import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getPlan, updatePlan, ApiError, getComments, createComment, resolveComment, unresolveComment, submitVersion, approveVersion, publishVersion } from '@/api';
import type { Plan, PlanVersion, ParentPlanInfo, SubPlanNavigationState, Step, Comment } from '@/types';
import { PlanBreadcrumb } from '@/components/PlanBreadcrumb';
import { StepEditor } from '@/components/StepEditor';
import { ChatPanel } from '@/components/ChatPanel';
import { CommentThread } from '@/components/CommentThread';
import { WorkflowActions } from '@/components/WorkflowActions';
import { useAIChat, useAIConnectionStatus, usePlanEvents } from '@/hooks';

/** Panel type for coexistence - only one panel can be open at a time */
type ActivePanel = 'chat' | 'comments' | null;

export function PlanEditorPage() {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // AI connection status - check if planning agent is active
  const {
    status: connectionStatus,
    connect: connectToAgent,
    isConnecting,
    connectError,
  } = useAIConnectionStatus(planId ?? null);

  // Clear connection error handler
  const [localConnectError, setLocalConnectError] = useState<string | null>(null);
  useEffect(() => {
    setLocalConnectError(connectError);
  }, [connectError]);
  const clearConnectError = useCallback(() => setLocalConnectError(null), []);

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

  // Real-time sync: Subscribe to plan changes when AI agent is connected
  const { isConnected: isEventStreamConnected, error: eventStreamError } = usePlanEvents(
    planId ?? null,
    connectionStatus === 'connected',
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

  // AI chat hook - must be called unconditionally (before early returns)
  // Use mock when not connected to real agent
  const aiChat = useAIChat(version, { useMock: connectionStatus !== 'connected' });

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

  // Panel coexistence handlers
  const openChatPanel = useCallback(() => {
    setActivePanel('chat');
    // Also call aiChat.open to ensure its internal state is synced
    aiChat.open();
  }, [aiChat]);

  const openCommentsPanel = useCallback((stepId: string) => {
    setCommentStepId(stepId);
    setActivePanel('comments');
  }, []);

  const closeActivePanel = useCallback(() => {
    setActivePanel(null);
    setCommentStepId(null);
    aiChat.close();
  }, [aiChat]);

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

  // Keyboard shortcut: Cmd+/ (or Ctrl+/) toggles chat panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        if (activePanel === 'chat') {
          closeActivePanel();
        } else {
          openChatPanel();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, openChatPanel, closeActivePanel]);

  if (loading) {
    return (
      <div className="plan-editor-page">
        <div className="loading">Loading plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-editor-page">
        <div className="error-message">{error}</div>
        <Link to="/plans" className="btn btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  if (!plan || !version) {
    return (
      <div className="plan-editor-page">
        <div className="error-message">Plan not found</div>
        <Link to="/plans" className="btn btn-secondary">
          Back to Plans
        </Link>
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'badge badge-draft';
      case 'approved':
        return 'badge badge-approved';
      case 'published':
        return 'badge badge-published';
      default:
        return 'badge';
    }
  };

  return (
    <div className="plan-editor-page">
      <div className="plan-header">
        <div className="plan-header-main">
          <PlanBreadcrumb parents={parents} currentGoal={version.summary.goal} />
          <h1 className="plan-goal">{version.summary.goal || 'Untitled Plan'}</h1>
          <div className="plan-meta">
            <span className={getStatusBadgeClass(version.status)}>{version.status}</span>
            <span className="plan-version">Version {version.version}</span>
            {version.submitted_at && <span className="badge badge-submitted">Submitted</span>}
          </div>
          <WorkflowActions
            version={version}
            onSubmit={handleWorkflowSubmit}
            onApprove={handleWorkflowApprove}
            onPublish={handleWorkflowPublish}
          />
        </div>
      </div>

      {version.summary.context && (
        <div className="plan-context">
          <h2>Context</h2>
          <p>{version.summary.context}</p>
        </div>
      )}

      <div className="plan-steps">
        <h2>Steps ({version.steps.length})</h2>
        {version.steps.length === 0 ? (
          <div className="empty-state">
            <p>No steps yet. Add steps to define the work needed to achieve your goal.</p>
          </div>
        ) : (
          <div className="steps-list">
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
                  <div key={step.step_id} className="step-item has-subplan">
                    <Link
                      to={`/plans/${step.sub_plan_id}`}
                      className="step-subplan-link"
                      state={{ parents: newParents }}
                      aria-label={`Navigate to sub-plan: ${step.title}`}
                    >
                      <div className="step-header">
                        <span className="step-title">{step.title}</span>
                        {step.scope && <span className="step-scope">{step.scope}</span>}
                        <span className="badge badge-subplan">Sub-plan</span>
                      </div>
                    </Link>
                  </div>
                );
              }

              // Regular steps use StepEditor
              return (
                <div
                  key={step.step_id}
                  className={`step-item${isSelected ? ' step-item--selected' : ''}`}
                  onClick={(e) => {
                    // Don't toggle selection if clicking interactive elements (buttons, inputs, etc.)
                    const target = e.target as HTMLElement;
                    const isInteractive = target.closest('button, input, select, textarea, a, [role="button"]');
                    if (!isInteractive) {
                      setSelectedStep(isSelected ? undefined : step);
                    }
                  }}
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
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="plan-timestamps">
        <span>Created: {new Date(version.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(version.updated_at).toLocaleString()}</span>
      </div>

      {/* AI Chat Panel */}
      <ChatPanel
        isOpen={activePanel === 'chat'}
        onClose={closeActivePanel}
        version={version}
        messages={aiChat.messages}
        isLoading={aiChat.isLoading}
        selectedStep={selectedStep}
        connectionStatus={connectionStatus}
        planStatus={version.status}
        isConnecting={isConnecting}
        connectError={localConnectError}
        onConnect={connectToAgent}
        onClearConnectError={clearConnectError}
        onSendMessage={aiChat.sendMessage}
        onApplySuggestion={aiChat.applySuggestion}
        onDismissSuggestion={aiChat.dismissSuggestion}
      />

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

      {/* Panel toggle buttons (visible when panels closed) */}
      {activePanel === null && (
        <div className="panel-toggle-buttons">
          <button
            className="chat-toggle-button"
            onClick={openChatPanel}
            aria-label="Open AI Chat (Cmd+/)"
            title="AI Chat (Cmd+/)"
          >
            💬
          </button>
        </div>
      )}
    </div>
  );
}

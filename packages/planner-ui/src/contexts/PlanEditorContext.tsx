import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import type { Plan, PlanVersion, ParentPlanInfo, SubPlanNavigationState, Step, Comment } from '@/types';
import { getPlan, updatePlan, getComments, createComment, resolveComment, unresolveComment, submitVersion, approveVersion, publishVersion } from '@/api';
import { usePlanEvents } from '@/hooks';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { STORAGE_KEYS } from '@/config/storage-keys';
import type { ViewMode } from '@/components/ViewModeToggle';

/** Panel type for comments */
type ActivePanel = 'comments' | null;

interface PlanEditorContextValue {
  // Core plan data
  plan: Plan | null;
  version: PlanVersion | null;
  loading: boolean;
  error: string | null;
  parents: ParentPlanInfo[];

  // Sidebar state
  sidebarCollapsed: boolean;
  handleSidebarCollapseChange: (collapsed: boolean) => void;

  // Step selection and editing
  selectedStep: Step | undefined;
  setSelectedStep: (step: Step | undefined) => void;
  expandedStepId: string | null;
  setExpandedStepId: (id: string | null) => void;

  // Panel management
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;

  // Comment state
  commentStepId: string | null;
  comments: Comment[];
  commentStep: Step | null;
  openCommentsPanel: (stepId: string) => void;
  closeActivePanel: () => void;
  handleAddComment: (stepId: string, content: string, parentId?: string) => Promise<void>;
  handleResolveComment: (commentId: string) => Promise<void>;
  handleUnresolveComment: (commentId: string) => Promise<void>;
  getStepComments: (stepId: string) => Comment[];
  getUnresolvedCount: (stepId: string) => number;

  // View mode state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  hoveredStepId: string | null;
  setHoveredStepId: (id: string | null) => void;
  hoveredDirection: 'incoming' | 'outgoing' | null;
  setHoveredDirection: (direction: 'incoming' | 'outgoing' | null) => void;
  stepsContainerRef: React.RefObject<HTMLDivElement>;
  handleScrollToStep: (stepId: string) => void;

  // Plan mutations
  handleStepUpdate: (stepId: string, updates: Partial<Step>) => Promise<void>;
  handleStepDelete: (stepId: string) => Promise<void>;
  handleGoalUpdate: (newGoal: string) => Promise<void>;
  handleContextUpdate: (newContext: string) => Promise<void>;
  handleWorkflowSubmit: () => Promise<void>;
  handleWorkflowApprove: (approver: string) => Promise<void>;
  handleWorkflowPublish: () => Promise<void>;

  // Real-time sync
  isEventStreamConnected: boolean;
  eventStreamError: string | null;

  // User info
  currentUser: ReturnType<typeof useCurrentUser>;
}

const PlanEditorContext = createContext<PlanEditorContextValue | null>(null);

export function PlanEditorProvider({ children }: { children: ReactNode }) {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const currentUser = useCurrentUser();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Messaging sidebar collapsed state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
    return stored === 'true';
  });

  // Persist sidebar collapsed state
  const handleSidebarCollapseChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(collapsed));
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
      // Update if fetched version is newer OR same version but updated more recently
      // (understanding/context updates don't create new versions, only update timestamp)
      setVersion((prev) => {
        if (!prev) return result.version;
        if (result.version.version > prev.version) return result.version;
        if (result.version.version === prev.version && result.version.updated_at > prev.updated_at) {
          return result.version;
        }
        return prev;
      });
      setPlan(result.plan);
    } catch (err) {
      console.error('[PlanEditorContext] Failed to refetch plan:', err);
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
      console.warn('[PlanEditorContext] Event stream error:', eventStreamError);
    }
    if (isEventStreamConnected) {
      console.debug('[PlanEditorContext] Event stream connected for real-time plan updates');
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
        if (err instanceof Error && 'message' in err) {
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
      if (!planId || !version || !currentUser) return;

      const result = await createComment(planId, version.version, stepId, content, currentUser.name, parentId);
      setComments((prev) => [...prev, result.comment]);
    },
    [planId, version, currentUser]
  );

  const handleResolveComment = useCallback(
    async (commentId: string) => {
      if (!planId || !version || !currentUser) return;

      const result = await resolveComment(planId, version.version, commentId, currentUser.name);
      setComments((prev) =>
        prev.map((c) => (c.comment_id === commentId ? result.comment : c))
      );
    },
    [planId, version, currentUser]
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
    ? version?.steps.find((s) => s.step_id === commentStepId) || null
    : null;

  const value: PlanEditorContextValue = {
    plan,
    version,
    loading,
    error,
    parents,
    sidebarCollapsed,
    handleSidebarCollapseChange,
    selectedStep,
    setSelectedStep,
    expandedStepId,
    setExpandedStepId,
    activePanel,
    setActivePanel,
    commentStepId,
    comments,
    commentStep,
    openCommentsPanel,
    closeActivePanel,
    handleAddComment,
    handleResolveComment,
    handleUnresolveComment,
    getStepComments,
    getUnresolvedCount,
    viewMode,
    setViewMode,
    hoveredStepId,
    setHoveredStepId,
    hoveredDirection,
    setHoveredDirection,
    stepsContainerRef,
    handleScrollToStep,
    handleStepUpdate,
    handleStepDelete,
    handleGoalUpdate,
    handleContextUpdate,
    handleWorkflowSubmit,
    handleWorkflowApprove,
    handleWorkflowPublish,
    isEventStreamConnected,
    eventStreamError,
    currentUser,
  };

  return (
    <PlanEditorContext.Provider value={value}>
      {children}
    </PlanEditorContext.Provider>
  );
}

export function usePlanEditor() {
  const context = useContext(PlanEditorContext);
  if (!context) {
    throw new Error('usePlanEditor must be used within PlanEditorProvider');
  }
  return context;
}

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PlanVersion, Improvement, FlaggedConcern, ActivityEntry, ImprovementType } from '@/types';
import { getImprovements, applyImprovement, dismissImprovement, type ApiImprovement } from '@/api';
import { useAIConnectionStatus } from './useAIConnectionStatus';

const AI_API_BASE = import.meta.env.VITE_AI_API_URL || '/api/ai';

/** Polling interval for API improvements (ms) */
const API_POLL_INTERVAL = 10000;

/** Idle time before triggering analysis (ms) */
const IDLE_THRESHOLD = 5000;

/** Minimum time between analyses (ms) */
const RATE_LIMIT = 30000;

interface UseAIImprovementsOptions {
  /** Enable background analysis */
  enabled?: boolean;
  /** Use mock responses instead of real API */
  useMock?: boolean;
}

interface UseAIImprovementsResult {
  /** List of improvements made */
  improvements: Improvement[];
  /** Count of applied improvements */
  improvementCount: number;
  /** Flagged concerns that need human attention */
  concerns: FlaggedConcern[];
  /** Activity log entries */
  activityLog: ActivityEntry[];
  /** Whether analysis is in progress */
  isAnalyzing: boolean;
  /** Whether connected to real AI (vs mock mode) */
  isConnected: boolean;
  /** Undo a specific improvement */
  undoImprovement: (improvementId: string) => void;
  /** Dismiss a flagged concern */
  dismissConcern: (concernId: string) => void;
  /** Apply an improvement suggestion (API mode) */
  applyImprovementSuggestion: (improvementId: string) => void;
  /** Clear all improvements */
  clearImprovements: () => void;
  /** Manually trigger analysis */
  triggerAnalysis: () => void;
}

interface AIAnalysisResponse {
  improvements: Array<{
    type: Improvement['type'];
    step_id: string;
    description: string;
    before: unknown;
    after: unknown;
  }>;
  concerns: Array<{
    step_id: string;
    severity: FlaggedConcern['severity'];
    title: string;
    description: string;
    suggestions?: string[];
  }>;
}

/**
 * Build plan context for AI analysis
 */
function buildAnalysisContext(version: PlanVersion) {
  return {
    plan_id: version.plan_id,
    version: version.version,
    goal: version.summary.goal,
    context: version.summary.context,
    steps: version.steps.map((step) => ({
      step_id: step.step_id,
      title: step.title,
      description: step.description,
      scope: step.scope,
      dependencies: step.dependencies,
      acceptance_criteria: step.acceptance_criteria,
      owner_role: step.owner_role,
    })),
  };
}

/**
 * Map API improvement type to UI improvement type
 */
function mapApiTypeToUiType(apiType: ApiImprovement['type']): ImprovementType {
  const typeMap: Record<ApiImprovement['type'], ImprovementType> = {
    'missing_criteria': 'criteria',
    'unclear_description': 'description',
    'missing_dependency': 'dependencies',
    'redundant_step': 'scope',
    'scope_suggestion': 'scope',
  };
  return typeMap[apiType] || 'scope';
}

/**
 * Convert API improvement to UI improvement format
 */
function apiToUiImprovement(api: ApiImprovement): Improvement {
  return {
    id: api.improvement_id,
    type: mapApiTypeToUiType(api.type),
    step_id: api.step_id || '',
    description: api.description,
    before: null,
    after: api.suggested_change,
    status: api.status === 'accepted' ? 'applied' : 'applied', // pending shows as applied until dismissed
    timestamp: api.created_at,
  };
}

/**
 * Convert API improvement to flagged concern for pending items
 */
function apiToConcern(api: ApiImprovement): FlaggedConcern {
  return {
    id: api.improvement_id,
    step_id: api.step_id || '',
    severity: 'info',
    title: `AI Suggestion: ${api.type.replace(/_/g, ' ')}`,
    description: api.description,
    suggestions: api.suggested_change ? [`Apply: ${api.suggested_change.tool}`] : undefined,
    dismissed: false,
    timestamp: api.created_at,
  };
}

/**
 * Create mock analysis response for development
 */
function createMockAnalysisResponse(version: PlanVersion): AIAnalysisResponse {
  const improvements: AIAnalysisResponse['improvements'] = [];
  const concerns: AIAnalysisResponse['concerns'] = [];

  // Simulate finding steps with missing criteria
  version.steps.forEach((step) => {
    if (!step.acceptance_criteria || step.acceptance_criteria.length === 0) {
      // 30% chance to add mock improvement
      if (Math.random() < 0.3) {
        improvements.push({
          type: 'criteria',
          step_id: step.step_id,
          description: `Added acceptance criterion for "${step.title}"`,
          before: [],
          after: [{ id: crypto.randomUUID(), description: 'Implementation complete and tested' }],
        });
      }
    }

    // Simulate finding missing dependencies
    if (step.dependencies.length === 0 && version.steps.indexOf(step) > 0) {
      if (Math.random() < 0.2) {
        const prevStep = version.steps[version.steps.indexOf(step) - 1];
        concerns.push({
          step_id: step.step_id,
          severity: 'warning',
          title: 'Possible missing dependency',
          description: `"${step.title}" may depend on "${prevStep.title}"`,
          suggestions: [`Add ${prevStep.step_id} as dependency`],
        });
      }
    }

    // Simulate finding unclear descriptions
    if (!step.description || step.description.length < 20) {
      if (Math.random() < 0.2) {
        concerns.push({
          step_id: step.step_id,
          severity: 'info',
          title: 'Description could be more detailed',
          description: `Consider adding more context to "${step.title}"`,
        });
      }
    }
  });

  return { improvements, concerns };
}

/**
 * Hook for managing background AI improvements.
 *
 * Features:
 * - Triggers analysis after user idle period
 * - Respects rate limits
 * - Tracks improvements with undo capability
 * - Surfaces flagged concerns
 * - Maintains activity log
 * - Uses real API when connected to planning agent
 * - Falls back to mock when no active session
 */
export function useAIImprovements(
  version: PlanVersion | null,
  options: UseAIImprovementsOptions = {}
): UseAIImprovementsResult {
  const { enabled = true, useMock: forceUseMock } = options;

  // Check if connected to planning agent (shared status with chat)
  const { isConnected } = useAIConnectionStatus(version?.plan_id ?? null);

  // Use mock if explicitly forced or not connected
  const useMock = forceUseMock ?? !isConnected;

  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [concerns, setConcerns] = useState<FlaggedConcern[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Track last analysis time for rate limiting
  const lastAnalysisRef = useRef<number>(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const versionRef = useRef(version);

  // Track API improvement IDs to detect new ones
  const apiImprovementIdsRef = useRef<Set<string>>(new Set());

  // Update version ref
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  // Clear state when plan changes
  useEffect(() => {
    setImprovements([]);
    setConcerns([]);
    setActivityLog([]);
    lastAnalysisRef.current = 0;
    apiImprovementIdsRef.current = new Set();
  }, [version?.plan_id]);

  // Poll API for improvements when connected
  const pollApiImprovements = useCallback(async () => {
    const planId = versionRef.current?.plan_id;
    if (!planId || useMock) return;

    try {
      setIsAnalyzing(true);
      const response = await getImprovements(planId);

      // Convert pending API improvements to concerns (actionable suggestions)
      const pendingImprovements = response.improvements.filter((imp) => imp.status === 'pending');
      const newConcerns = pendingImprovements.map(apiToConcern);

      // Convert accepted API improvements to UI improvements
      const acceptedImprovements = response.improvements.filter((imp) => imp.status === 'accepted');
      const newImprovements = acceptedImprovements.map(apiToUiImprovement);

      // Check for new improvements to log
      const currentIds = new Set(response.improvements.map((i) => i.improvement_id));
      const newIds = [...currentIds].filter((id) => !apiImprovementIdsRef.current.has(id));

      if (newIds.length > 0) {
        const newActivities: ActivityEntry[] = newIds.map((id) => {
          const imp = response.improvements.find((i) => i.improvement_id === id);
          return {
            id: crypto.randomUUID(),
            type: 'ai_concern' as const,
            description: `AI suggested: ${imp?.description || 'improvement'}`,
            step_id: imp?.step_id || '',
            timestamp: new Date().toISOString(),
          };
        });
        setActivityLog((prev) => [...newActivities, ...prev]);
      }

      apiImprovementIdsRef.current = currentIds;
      setConcerns(newConcerns);
      setImprovements(newImprovements);
    } catch (error) {
      console.error('Failed to fetch API improvements:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [useMock]);

  // Set up API polling when connected
  useEffect(() => {
    if (useMock || !enabled || !version) {
      if (apiPollRef.current) {
        clearInterval(apiPollRef.current);
        apiPollRef.current = null;
      }
      return;
    }

    // Initial fetch
    pollApiImprovements();

    // Set up polling
    apiPollRef.current = setInterval(pollApiImprovements, API_POLL_INTERVAL);

    return () => {
      if (apiPollRef.current) {
        clearInterval(apiPollRef.current);
        apiPollRef.current = null;
      }
    };
  }, [useMock, enabled, version, pollApiImprovements]);

  const runAnalysis = useCallback(async () => {
    const currentVersion = versionRef.current;
    if (!currentVersion || isAnalyzing) return;

    // Check rate limit
    const now = Date.now();
    if (now - lastAnalysisRef.current < RATE_LIMIT) {
      return;
    }

    setIsAnalyzing(true);
    lastAnalysisRef.current = now;

    try {
      let response: AIAnalysisResponse;

      if (useMock) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
        response = createMockAnalysisResponse(currentVersion);
      } else {
        const context = buildAnalysisContext(currentVersion);
        const apiResponse = await fetch(`${AI_API_BASE}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
        });

        if (!apiResponse.ok) {
          throw new Error(`Analysis failed: ${apiResponse.status}`);
        }

        response = await apiResponse.json();
      }

      // Process improvements
      const newImprovements: Improvement[] = response.improvements.map((imp) => ({
        id: crypto.randomUUID(),
        type: imp.type,
        step_id: imp.step_id,
        description: imp.description,
        before: imp.before,
        after: imp.after,
        status: 'applied' as const,
        timestamp: new Date().toISOString(),
      }));

      // Process concerns (only add new ones)
      const newConcerns: FlaggedConcern[] = response.concerns.map((concern) => ({
        id: crypto.randomUUID(),
        step_id: concern.step_id,
        severity: concern.severity,
        title: concern.title,
        description: concern.description,
        suggestions: concern.suggestions,
        dismissed: false,
        timestamp: new Date().toISOString(),
      }));

      // Add to state
      if (newImprovements.length > 0) {
        setImprovements((prev) => [...prev, ...newImprovements]);

        // Add activity entries
        const newActivities: ActivityEntry[] = newImprovements.map((imp) => ({
          id: crypto.randomUUID(),
          type: 'ai_improvement' as const,
          description: imp.description,
          step_id: imp.step_id,
          improvement_id: imp.id,
          timestamp: imp.timestamp,
        }));
        setActivityLog((prev) => [...newActivities, ...prev]);
      }

      if (newConcerns.length > 0) {
        setConcerns((prev) => {
          // Filter out duplicates by step_id + title
          const existingKeys = new Set(prev.map((c) => `${c.step_id}:${c.title}`));
          const uniqueNew = newConcerns.filter((c) => !existingKeys.has(`${c.step_id}:${c.title}`));
          return [...prev, ...uniqueNew];
        });

        // Add activity entries for concerns
        const concernActivities: ActivityEntry[] = newConcerns.map((concern) => ({
          id: crypto.randomUUID(),
          type: 'ai_concern' as const,
          description: `Flagged: ${concern.title}`,
          step_id: concern.step_id,
          timestamp: concern.timestamp,
        }));
        setActivityLog((prev) => [...concernActivities, ...prev]);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, useMock]);

  // Set up idle detection
  useEffect(() => {
    if (!enabled || !version) return;

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        runAnalysis();
      }, IDLE_THRESHOLD);
    };

    // Listen for user activity
    const events = ['keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((event) => document.addEventListener(event, resetIdleTimer));

    // Start initial timer
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach((event) => document.removeEventListener(event, resetIdleTimer));
    };
  }, [enabled, version, runAnalysis]);

  const undoImprovement = useCallback(async (improvementId: string) => {
    const planId = versionRef.current?.plan_id;

    // For API mode, call dismiss endpoint
    if (!useMock && planId) {
      try {
        const result = await dismissImprovement(planId, improvementId);
        if (result.success) {
          // Refresh from API
          pollApiImprovements();
        }
      } catch (error) {
        console.error('Failed to dismiss improvement:', error);
      }
      return;
    }

    // Mock mode - local state update
    setImprovements((prev) =>
      prev.map((imp) => (imp.id === improvementId ? { ...imp, status: 'undone' as const } : imp))
    );

    const improvement = improvements.find((i) => i.id === improvementId);
    if (improvement) {
      const undoActivity: ActivityEntry = {
        id: crypto.randomUUID(),
        type: 'undo',
        description: `Undid: ${improvement.description}`,
        step_id: improvement.step_id,
        improvement_id: improvementId,
        timestamp: new Date().toISOString(),
      };
      setActivityLog((prev) => [undoActivity, ...prev]);
    }
  }, [improvements, useMock, pollApiImprovements]);

  const dismissConcern = useCallback(async (concernId: string) => {
    const planId = versionRef.current?.plan_id;

    // For API mode, call dismiss endpoint
    if (!useMock && planId) {
      try {
        const result = await dismissImprovement(planId, concernId);
        if (result.success) {
          // Refresh from API
          pollApiImprovements();
        }
      } catch (error) {
        console.error('Failed to dismiss concern:', error);
      }
      return;
    }

    // Mock mode - local state update
    setConcerns((prev) =>
      prev.map((c) => (c.id === concernId ? { ...c, dismissed: true } : c))
    );
  }, [useMock, pollApiImprovements]);

  // Apply an improvement (API mode only)
  const applyImprovementSuggestion = useCallback(async (improvementId: string) => {
    const planId = versionRef.current?.plan_id;
    if (!planId) return;

    try {
      const result = await applyImprovement(planId, improvementId);
      if (result.success) {
        // Log the apply action
        const concern = concerns.find((c) => c.id === improvementId);
        if (concern) {
          const applyActivity: ActivityEntry = {
            id: crypto.randomUUID(),
            type: 'ai_improvement',
            description: `Applied: ${concern.description}`,
            step_id: concern.step_id,
            improvement_id: improvementId,
            timestamp: new Date().toISOString(),
          };
          setActivityLog((prev) => [applyActivity, ...prev]);
        }
        // Refresh from API
        pollApiImprovements();
      }
    } catch (error) {
      console.error('Failed to apply improvement:', error);
    }
  }, [concerns, pollApiImprovements]);

  const clearImprovements = useCallback(() => {
    setImprovements([]);
    setConcerns([]);
  }, []);

  const triggerAnalysis = useCallback(() => {
    lastAnalysisRef.current = 0; // Reset rate limit
    runAnalysis();
  }, [runAnalysis]);

  const improvementCount = improvements.filter((i) => i.status === 'applied').length;

  return {
    improvements,
    improvementCount,
    concerns: concerns.filter((c) => !c.dismissed),
    activityLog,
    isAnalyzing,
    isConnected,
    undoImprovement,
    dismissConcern,
    applyImprovementSuggestion,
    clearImprovements,
    triggerAnalysis,
  };
}

/**
 * SessionContext Provider
 *
 * Session-first context: fetches the ideation session directly and derives
 * plans from the planner API. Replaces the project-centric approach where
 * a Project entity linked to a session/plan by foreign key.
 *
 * Data flow:
 *   1. GET /api/ideation/sessions/:id  → full session with blocks, planner_sends
 *   2. GET /api/plans?source_session_id=:id  → plans created from this session
 *      (fallback: extract plan_ids from planner_sends and fetch individually)
 *   3. SSE /api/ideation/sessions/:id/events  → real-time session events
 *   4. SSE /api/plans/:id/events  → real-time plan events (for activePlan)
 */

import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import {
  startBuild as forgeStartBuild,
  approveGate as forgeApproveGate,
  rejectGate as forgeRejectGate,
  answerQuestion as forgeAnswerQuestion,
  dismissQuestion as forgeDismissQuestion,
  pauseRun as forgePauseRun,
  resumeRun as forgeResumeRun,
  cancelRun as forgeCancelRun,
} from '@plannr/shared-ui';
import type { ForgeConfig } from '@plannr/shared-ui';
import { useBuildMonitor } from '@/hooks/useBuildMonitor';
import type { RunStatus, StepState, GateState, QuestionState, RunMetrics, BuildEvent } from '@/hooks/useBuildMonitor';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlanSummary {
  plan_id: string;
  goal: string;
  status: string;
  version: number;
  initiative_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Block entity from ideation domain */
export interface Block {
  id: string;
  session_id: string;
  keyword: string;
  content: string;
  status: 'forming' | 'ready' | 'curated' | 'archived';
  emoji?: string;
  userEdited?: boolean;
  userEditedFields?: string[];
  created_at: string;
  updated_at: string;
}

/** Planner send record within a session */
interface PlannerSend {
  sent_at: string;
  plan_id?: string;
  result?: {
    plan_id: string;
    plan_version: number;
  };
  understanding_snapshot: Record<string, unknown>;
}

/** Full ideation session from API */
export interface IdeationSession {
  id: string;
  status: 'active' | 'abandoned';
  initiative_id?: string;
  source: {
    type: 'human' | 'intake';
    initial_intent: string;
    channel_ref?: string;
  };
  active_specialists: Array<{
    name: string;
    role_hint?: string;
    joined_at: string;
  }>;
  aggregate_confidence: number;
  blocks: Block[];
  planner_sends: PlannerSend[];
  created_at: string;
  updated_at: string;
}

export interface SessionContextValue {
  session: IdeationSession | null;
  plans: PlanSummary[];
  /** Most recently created plan — last in plans array */
  activePlan: PlanSummary | null;
  /** Session blocks (from session.blocks) */
  blocks: Block[];
  loading: boolean;
  error: string | null;

  /** True when session has at least one block */
  hasBlocks: boolean;
  /** True when session has at least one plan */
  hasPlans: boolean;

  /** Increment to trigger re-fetch of plan steps in child components */
  planRefreshKey: number;
  /** Increment to trigger re-fetch of blocks in child components */
  blockRefreshKey: number;
  /** Increment to trigger re-fetch of transcript in child components */
  transcriptRefreshKey: number;

  /** Reload session and plans from API */
  refetch: () => void;

  /** Start a forge build for the given plan */
  startBuild: (planId: string, version: number, config: ForgeConfig) => Promise<string>;

  /** Active forge-next run ID, or null if no build is running */
  activeRunId: string | null;
  /** Build monitoring state */
  buildStatus: RunStatus | null;
  buildSteps: Map<string, StepState>;
  buildGates: GateState[];
  buildQuestions: QuestionState[];
  buildError: string | null;
  isBuildMonitoring: boolean;
  pendingGateCount: number;
  pendingQuestionCount: number;
  /** Run-level aggregate metrics (cost, satisfaction, progress) */
  buildRunMetrics: RunMetrics | null;
  /** Step names with active stall warnings */
  buildStallWarnings: string[];
  /** Raw event log from build SSE stream */
  buildEventLog: BuildEvent[];

  /** Build control actions */
  pauseBuild: () => Promise<void>;
  resumeBuild: () => Promise<void>;
  cancelBuild: () => Promise<void>;
  approveGate: (gateId: string, note?: string) => Promise<void>;
  rejectGate: (gateId: string, note?: string) => Promise<void>;
  answerQuestion: (questionId: string, answer: string) => Promise<void>;
  dismissQuestion: (questionId: string) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SessionContext = createContext<SessionContextValue | null>(null);

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = '/api';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/** Extract plan IDs referenced in planner_sends as a fallback source */
function extractPlanIdsFromSends(sends: PlannerSend[]): string[] {
  const ids = new Set<string>();
  for (const send of sends) {
    if (send.result?.plan_id) {
      ids.add(send.result.plan_id);
    } else if (send.plan_id) {
      ids.add(send.plan_id);
    }
  }
  return Array.from(ids);
}

// ── SSE hook (internal) ───────────────────────────────────────────────────────

interface SessionSseCallbacks {
  onTranscriptUpdated: () => void;
  onUnderstandingUpdated: () => void;
  onBlockUpdate: () => void;
  onBlocksGraduated: () => void;
  onPlannerSend: () => void;
  onStatus: (status: 'active' | 'abandoned') => void;
}

/**
 * Manages SSE connection to the ideation session events endpoint.
 * Isolated here so SessionProvider stays readable.
 */
function useSessionSse(sessionId: string | null, callbacks: SessionSseCallbacks) {
  const callbacksRef = useRef(callbacks);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const connect = useCallback((id: string) => {
    sourceRef.current?.close();

    const url = `${API_BASE}/ideation/sessions/${id}/events`;
    console.log(`[SessionContext] Connecting to SSE: ${url}`);

    const es = new EventSource(url);

    es.onopen = () => {
      console.log(`[SessionContext] SSE connected for session ${id}`);
      reconnectAttemptsRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[SessionContext] SSE event: ${data.type}`);

        switch (data.type) {
          case 'ping':
            break;
          case 'transcript_updated':
            callbacksRef.current.onTranscriptUpdated();
            break;
          case 'understanding_updated':
            callbacksRef.current.onUnderstandingUpdated();
            break;
          case 'block_update':
            callbacksRef.current.onBlockUpdate();
            break;
          case 'session:blocks_graduated':
            callbacksRef.current.onBlocksGraduated();
            break;
          case 'session:planner_send':
            callbacksRef.current.onPlannerSend();
            break;
          case 'status_changed':
            callbacksRef.current.onStatus(data.status);
            break;
          default:
            console.log(`[SessionContext] Unknown SSE event: ${data.type}`);
        }
      } catch (err) {
        console.error('[SessionContext] SSE parse error:', err);
      }
    };

    es.onerror = () => {
      console.error('[SessionContext] SSE error');
      es.close();

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 3);
        console.log(`[SessionContext] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => connect(id), delay);
      } else {
        console.error('[SessionContext] Max SSE reconnect attempts reached');
      }
    };

    sourceRef.current = es;
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    connect(sessionId);

    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [sessionId, connect]);
}

/**
 * Manages SSE connection to the planner plan events endpoint for a single plan.
 * Used to keep planRefreshKey current when the active plan changes.
 */
function usePlanSse(planId: string | null, onPlanChange: () => void) {
  const onPlanChangeRef = useRef(onPlanChange);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    onPlanChangeRef.current = onPlanChange;
  }, [onPlanChange]);

  const connect = useCallback((id: string) => {
    sourceRef.current?.close();

    const url = `${API_BASE}/plans/${id}/events`;
    console.log(`[SessionContext] Connecting to plan SSE: ${url}`);

    const es = new EventSource(url);

    es.onopen = () => {
      console.log(`[SessionContext] Plan SSE connected for plan ${id}`);
      reconnectAttemptsRef.current = 0;
    };

    es.addEventListener('plan_change', (e: MessageEvent) => {
      try {
        JSON.parse(e.data); // parse to validate
        onPlanChangeRef.current();
      } catch (err) {
        console.error('[SessionContext] Plan SSE parse error:', err);
      }
    });

    es.onerror = () => {
      console.error('[SessionContext] Plan SSE error');
      es.close();

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 3);
        reconnectTimeoutRef.current = setTimeout(() => connect(id), delay);
      }
    };

    sourceRef.current = es;
  }, []);

  useEffect(() => {
    if (!planId) {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }

    connect(planId);

    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [planId, connect]);
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface SessionProviderProps {
  sessionId: string;
  children: ReactNode;
}

export function SessionProvider({ sessionId, children }: SessionProviderProps) {
  const [session, setSession] = useState<IdeationSession | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [blockRefreshKey, setBlockRefreshKey] = useState(0);
  const [transcriptRefreshKey, setTranscriptRefreshKey] = useState(0);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const buildMonitor = useBuildMonitor(activeRunId);

  // ── Plan fetching ─────────────────────────────────────────────────────────

  const fetchPlans = useCallback(async (sess: IdeationSession): Promise<PlanSummary[]> => {
    // Primary: query by source_session_id
    try {
      const result = await fetchJson<{ plans: PlanSummary[] }>(
        `${API_BASE}/plans?source_session_id=${sess.id}`
      );
      if (result.plans && result.plans.length > 0) {
        return result.plans;
      }
    } catch (err) {
      console.warn('[SessionContext] source_session_id query failed:', err);
    }

    // Fallback: fetch each plan referenced in planner_sends
    const fallbackIds = extractPlanIdsFromSends(sess.planner_sends);
    if (fallbackIds.length === 0) {
      return [];
    }

    const settled = await Promise.allSettled(
      fallbackIds.map((id) =>
        fetchJson<{ plan: PlanSummary }>(`${API_BASE}/plans/${id}`).then((r) => r.plan)
      )
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<PlanSummary> => r.status === 'fulfilled')
      .map((r) => r.value);
  }, []);

  // ── Full load ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sess = await fetchJson<IdeationSession>(
        `${API_BASE}/ideation/sessions/${sessionId}`
      );
      setSession(sess);

      const fetchedPlans = await fetchPlans(sess);
      // Sort ascending by created_at so activePlan = last
      const sorted = [...fetchedPlans].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setPlans(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      setError(message);
      console.error('[SessionContext] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, fetchPlans]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Session-only refetch (lighter than full load) ──────────────────────────

  const refetchSession = useCallback(() => {
    fetchJson<IdeationSession>(`${API_BASE}/ideation/sessions/${sessionId}`)
      .then((sess) => setSession(sess))
      .catch((err) => console.warn('[SessionContext] Session refetch failed:', err));
  }, [sessionId]);

  // ── Plans refetch ──────────────────────────────────────────────────────────

  const refetchPlans = useCallback(() => {
    if (!session) return;
    fetchPlans(session)
      .then((fetched) => {
        const sorted = [...fetched].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setPlans(sorted);
        setPlanRefreshKey((k) => k + 1);
      })
      .catch((err) => console.warn('[SessionContext] Plans refetch failed:', err));
  }, [session, fetchPlans]);

  // ── SSE: ideation session events ──────────────────────────────────────────

  useSessionSse(sessionId, {
    onTranscriptUpdated: () => {
      console.log('[SessionContext] transcript updated');
      setTranscriptRefreshKey((k) => k + 1);
    },
    onUnderstandingUpdated: () => {
      console.log('[SessionContext] understanding updated');
      refetchSession();
    },
    onBlockUpdate: () => {
      console.log('[SessionContext] block updated');
      setBlockRefreshKey((k) => k + 1);
    },
    onBlocksGraduated: () => {
      console.log('[SessionContext] blocks graduated');
      setBlockRefreshKey((k) => k + 1);
    },
    onPlannerSend: () => {
      console.log('[SessionContext] planner send detected');
      // Full refetch to pick up the new plan from planner_sends
      fetchAll();
      setPlanRefreshKey((k) => k + 1);
    },
    onStatus: (status) => {
      console.log('[SessionContext] session status changed:', status);
      setSession((prev) => (prev ? { ...prev, status } : prev));
    },
  });

  // ── SSE: active plan events ───────────────────────────────────────────────

  const activePlanId = plans.length > 0 ? plans[plans.length - 1].plan_id : null;

  usePlanSse(activePlanId, () => {
    console.log('[SessionContext] active plan changed');
    setPlanRefreshKey((k) => k + 1);
    refetchPlans();
  });

  // ── Derived state ─────────────────────────────────────────────────────────

  const blocks: Block[] = session?.blocks ?? [];
  const activePlan: PlanSummary | null = plans.length > 0 ? plans[plans.length - 1] : null;
  const hasBlocks = blocks.length > 0;
  const hasPlans = plans.length > 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  const startBuild = useCallback(async (planId: string, version: number, config: ForgeConfig): Promise<string> => {
    const result = await forgeStartBuild({
      plan_id: planId,
      plan_version: version,
      workspace_path: config.workspace_path,
      execution_policy: config.execution_policy,
      step_overrides: config.step_overrides,
    });
    setActiveRunId(result.run_id);
    return result.run_id;
  }, []);

  const pauseBuild = useCallback(async () => {
    if (!activeRunId) return;
    await forgePauseRun(activeRunId);
  }, [activeRunId]);

  const resumeBuild = useCallback(async () => {
    if (!activeRunId) return;
    await forgeResumeRun(activeRunId);
  }, [activeRunId]);

  const cancelBuild = useCallback(async () => {
    if (!activeRunId) return;
    await forgeCancelRun(activeRunId);
  }, [activeRunId]);

  const handleApproveGate = useCallback(async (gateId: string, note?: string) => {
    await forgeApproveGate(gateId, undefined, note);
  }, []);

  const handleRejectGate = useCallback(async (gateId: string, note?: string) => {
    await forgeRejectGate(gateId, undefined, note);
  }, []);

  const handleAnswerQuestion = useCallback(async (questionId: string, answer: string) => {
    await forgeAnswerQuestion(questionId, answer);
  }, []);

  const handleDismissQuestion = useCallback(async (questionId: string) => {
    await forgeDismissQuestion(questionId);
  }, []);

  const value: SessionContextValue = {
    session,
    plans,
    activePlan,
    blocks,
    loading,
    error,
    hasBlocks,
    hasPlans,
    planRefreshKey,
    blockRefreshKey,
    transcriptRefreshKey,
    refetch: fetchAll,
    startBuild,
    activeRunId,
    buildStatus: buildMonitor.runStatus,
    buildSteps: buildMonitor.steps,
    buildGates: buildMonitor.gates,
    buildQuestions: buildMonitor.questions,
    buildError: buildMonitor.runError,
    isBuildMonitoring: buildMonitor.isMonitoring,
    pendingGateCount: buildMonitor.pendingGateCount,
    pendingQuestionCount: buildMonitor.pendingQuestionCount,
    buildRunMetrics: buildMonitor.runMetrics,
    buildStallWarnings: buildMonitor.stallWarnings,
    buildEventLog: buildMonitor.eventLog,
    pauseBuild,
    resumeBuild,
    cancelBuild,
    approveGate: handleApproveGate,
    rejectGate: handleRejectGate,
    answerQuestion: handleAnswerQuestion,
    dismissQuestion: handleDismissQuestion,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

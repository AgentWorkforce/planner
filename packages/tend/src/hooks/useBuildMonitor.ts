/**
 * useBuildMonitor Hook
 *
 * Manages an SSE connection to the forge-next events endpoint and provides
 * real-time build monitoring state via useReducer for complex state transitions.
 */

import { useEffect, useRef, useCallback, useReducer, useMemo } from 'react';

const API_BASE_URL = '/api/forge-next';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type EscalationType = 'gate' | 'question' | 'stall' | 'retries_exhausted' | 'low_quality' | 'merge_failed';

export interface StepEscalation {
  type: EscalationType;
  detail: string;
  gateId?: string;
  questionId?: string;
}

export interface StepState {
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
  output?: string;
  error?: string;
  attempt?: number;
  // Quality monitoring fields
  score?: number;
  scoreReasoning?: string;
  matchedCriteria?: string[];
  failedCriteria?: string[];
  failures?: string[];
  estimatedCostUsd?: number;
  durationMs?: number;
  model?: string;
  stallWarning?: boolean;
  // Escalation fields
  escalation?: StepEscalation;
  retryHints?: string[];
  mergeStrategy?: string;
  retriesExhausted?: boolean;
  maxRetries?: number;
  mergeStatus?: 'pending' | 'merging' | 'merged' | 'failed' | 'skipped';
  mergeBranch?: string;
  mergeTargetBranch?: string;
  mergeError?: string;
}

export interface RunMetrics {
  totalCostUsd: number;
  avgSatisfaction: number;
  stepsCompleted: number;
  stepsTotal: number;
}

export interface GateState {
  gateId: string;
  stepId: string;
  stepName: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string | null;
  decisionNote?: string | null;
}

export interface QuestionState {
  questionId: string;
  stepId: string;
  question: string;
  status: 'pending' | 'answered' | 'dismissed';
  answer?: string | null;
}

export interface UseBuildMonitorReturn {
  /** Current run status */
  runStatus: RunStatus | null;
  /** Step states keyed by step_name */
  steps: Map<string, StepState>;
  /** All tracked gates (pending and resolved) */
  gates: GateState[];
  /** All tracked questions (pending and resolved) */
  questions: QuestionState[];
  /** SSE connection status */
  connected: boolean;
  /** Run error message if failed */
  runError: string | null;
  /** Whether a build is actively being monitored */
  isMonitoring: boolean;
  /** Count of pending gates */
  pendingGateCount: number;
  /** Count of pending questions */
  pendingQuestionCount: number;
  /** Run-level aggregate metrics */
  runMetrics: RunMetrics | null;
  /** Step names with active stall warnings */
  stallWarnings: string[];
}

// ---------------------------------------------------------------------------
// Reducer types and logic
// ---------------------------------------------------------------------------

type BuildAction =
  | { type: 'RESET' }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'RUN_STATUS'; status: RunStatus; error?: string }
  | {
      type: 'STEP_STATUS';
      stepName: string;
      status: StepState['status'];
      output?: string;
      error?: string;
      attempt?: number;
    }
  | { type: 'GATE_PENDING'; gateId: string; stepId: string; stepName: string }
  | {
      type: 'GATE_DECIDED';
      gateId: string;
      status: 'approved' | 'rejected';
      approver?: string | null;
      decisionNote?: string | null;
    }
  | { type: 'QUESTION_PENDING'; questionId: string; stepId: string; question: string }
  | {
      type: 'QUESTION_RESOLVED';
      questionId: string;
      status: 'answered' | 'dismissed';
      answer?: string | null;
    }
  | { type: 'STEP_SCORED'; stepName: string; score: number; reasoning: string; matchedCriteria: string[]; failedCriteria: string[] }
  | { type: 'STEP_METRICS'; stepName: string; model: string; durationMs: number; estimatedCostUsd: number }
  | { type: 'RUN_METRICS'; totalCostUsd: number; avgSatisfaction: number; stepsCompleted: number; stepsTotal: number }
  | { type: 'STALL_WARNING'; stepName: string }
  | { type: 'STEP_FAILED_ENRICHED'; stepName: string; error: string; failures: string[]; attempt: number }
  | { type: 'STEP_RETRY_CONTEXT'; stepName: string; attempt: number; previousFailures: string[]; retryHints?: string[] }
  | { type: 'STEP_RETRIES_EXHAUSTED'; stepName: string; attempt: number; maxRetries: number; failures: string[] }
  | { type: 'STEP_METRICS_MERGE'; stepName: string; mergeStrategy: string }
  | { type: 'STEP_MERGE_STATUS'; stepName: string; status: 'pending' | 'merging' | 'merged' | 'failed' | 'skipped'; branch?: string; targetBranch?: string; error?: string };

interface BuildState {
  runStatus: RunStatus | null;
  runError: string | null;
  steps: Map<string, StepState>;
  gates: GateState[];
  questions: QuestionState[];
  connected: boolean;
  runMetrics: RunMetrics | null;
  stallWarnings: Set<string>;
}

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set(['completed', 'failed', 'cancelled']);

/**
 * Derive escalation for a step from its state and related gates/questions.
 * Priority: gate > question > retries_exhausted > stall > low_quality
 */
function deriveEscalation(
  step: StepState,
  gates: GateState[],
  questions: QuestionState[],
): StepEscalation | undefined {
  // Gate pending for this step
  const pendingGate = gates.find(g => g.status === 'pending' && g.stepName === step.stepName);
  if (pendingGate) {
    return { type: 'gate', detail: `Awaiting approval for ${step.stepName}`, gateId: pendingGate.gateId };
  }

  // Question pending for this step (match by stepId which is step_name in our SSE)
  const pendingQuestion = questions.find(q => q.status === 'pending' && q.stepId === step.stepName);
  if (pendingQuestion) {
    return { type: 'question', detail: pendingQuestion.question, questionId: pendingQuestion.questionId };
  }

  // Retries exhausted
  if (step.retriesExhausted) {
    return { type: 'retries_exhausted', detail: `Failed ${step.attempt ?? 0}/${step.maxRetries ?? 0} attempts` };
  }

  // Merge failed
  if (step.mergeStatus === 'failed') {
    return { type: 'merge_failed', detail: step.mergeError ?? 'Merge failed' };
  }

  // Stall warning
  if (step.stallWarning) {
    return { type: 'stall', detail: `Step running longer than expected` };
  }

  // Low quality score
  if (step.status === 'completed' && step.score !== undefined && step.score < 40) {
    return { type: 'low_quality', detail: `Score ${step.score}/100` };
  }

  return undefined;
}

const initialState: BuildState = {
  runStatus: null,
  runError: null,
  steps: new Map(),
  gates: [],
  questions: [],
  connected: false,
  runMetrics: null,
  stallWarnings: new Set(),
};

function buildReducer(state: BuildState, action: BuildAction): BuildState {
  switch (action.type) {
    case 'RESET':
      return { ...initialState, stallWarnings: new Set() };

    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };

    case 'RUN_STATUS':
      return {
        ...state,
        runStatus: action.status,
        runError: action.error ?? null,
      };

    case 'STEP_STATUS': {
      const next = new Map(state.steps);
      const existing = next.get(action.stepName);
      const updated: StepState = {
        stepName: action.stepName,
        status: action.status,
        output: action.output ?? existing?.output,
        error: action.error ?? existing?.error,
        attempt: action.attempt ?? existing?.attempt,
        // Preserve quality fields across status updates
        score: existing?.score,
        scoreReasoning: existing?.scoreReasoning,
        matchedCriteria: existing?.matchedCriteria,
        failedCriteria: existing?.failedCriteria,
        failures: existing?.failures,
        estimatedCostUsd: existing?.estimatedCostUsd,
        durationMs: existing?.durationMs,
        model: existing?.model,
        stallWarning: existing?.stallWarning,
        retryHints: existing?.retryHints,
        mergeStrategy: existing?.mergeStrategy,
        retriesExhausted: existing?.retriesExhausted,
        maxRetries: existing?.maxRetries,
        mergeStatus: existing?.mergeStatus,
        mergeBranch: existing?.mergeBranch,
        mergeTargetBranch: existing?.mergeTargetBranch,
        mergeError: existing?.mergeError,
      };
      updated.escalation = deriveEscalation(updated, state.gates, state.questions);
      next.set(action.stepName, updated);
      return { ...state, steps: next };
    }

    case 'GATE_PENDING': {
      // Avoid duplicate pending gates for the same gateId
      const alreadyTracked = state.gates.some((g) => g.gateId === action.gateId);
      if (alreadyTracked) return state;
      const newGate: GateState = {
        gateId: action.gateId,
        stepId: action.stepId,
        stepName: action.stepName,
        status: 'pending',
      };
      const newGates = [...state.gates, newGate];
      // Re-derive escalation for the affected step
      const steps = new Map(state.steps);
      const gateStep = steps.get(action.stepName);
      if (gateStep) {
        const updated = { ...gateStep };
        updated.escalation = deriveEscalation(updated, newGates, state.questions);
        steps.set(action.stepName, updated);
      }
      return { ...state, gates: newGates, steps };
    }

    case 'GATE_DECIDED': {
      const gates = state.gates.map((g) =>
        g.gateId === action.gateId
          ? {
              ...g,
              status: action.status,
              approver: action.approver ?? g.approver,
              decisionNote: action.decisionNote ?? g.decisionNote,
            }
          : g
      );
      // Re-derive escalation for the step whose gate was decided
      const decidedGate = state.gates.find(g => g.gateId === action.gateId);
      const steps = new Map(state.steps);
      if (decidedGate) {
        const gateStep = steps.get(decidedGate.stepName);
        if (gateStep) {
          const updated = { ...gateStep };
          updated.escalation = deriveEscalation(updated, gates, state.questions);
          steps.set(decidedGate.stepName, updated);
        }
      }
      return { ...state, gates, steps };
    }

    case 'QUESTION_PENDING': {
      const alreadyTracked = state.questions.some((q) => q.questionId === action.questionId);
      if (alreadyTracked) return state;
      const newQuestion: QuestionState = {
        questionId: action.questionId,
        stepId: action.stepId,
        question: action.question,
        status: 'pending',
      };
      const newQuestions = [...state.questions, newQuestion];
      // Re-derive escalation for the affected step
      const steps = new Map(state.steps);
      const qStep = steps.get(action.stepId);
      if (qStep) {
        const updated = { ...qStep };
        updated.escalation = deriveEscalation(updated, state.gates, newQuestions);
        steps.set(action.stepId, updated);
      }
      return { ...state, questions: newQuestions, steps };
    }

    case 'QUESTION_RESOLVED': {
      const questions = state.questions.map((q) =>
        q.questionId === action.questionId
          ? {
              ...q,
              status: action.status,
              answer: action.answer ?? q.answer,
            }
          : q
      );
      // Re-derive escalation for the step whose question was resolved
      const resolvedQ = state.questions.find(q => q.questionId === action.questionId);
      const steps = new Map(state.steps);
      if (resolvedQ) {
        const qStep = steps.get(resolvedQ.stepId);
        if (qStep) {
          const updated = { ...qStep };
          updated.escalation = deriveEscalation(updated, state.gates, questions);
          steps.set(resolvedQ.stepId, updated);
        }
      }
      return { ...state, questions, steps };
    }

    case 'STEP_SCORED': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = {
          ...existing,
          score: action.score,
          scoreReasoning: action.reasoning,
          matchedCriteria: action.matchedCriteria,
          failedCriteria: action.failedCriteria,
        };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      return { ...state, steps };
    }

    case 'STEP_METRICS': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = {
          ...existing,
          model: action.model,
          durationMs: action.durationMs,
          estimatedCostUsd: action.estimatedCostUsd,
          stallWarning: false, // clear stall on metrics (step completed)
        };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      // Also clear from stall warnings
      const stallWarnings = new Set(state.stallWarnings);
      stallWarnings.delete(action.stepName);
      return { ...state, steps, stallWarnings };
    }

    case 'RUN_METRICS':
      return {
        ...state,
        runMetrics: {
          totalCostUsd: action.totalCostUsd,
          avgSatisfaction: action.avgSatisfaction,
          stepsCompleted: action.stepsCompleted,
          stepsTotal: action.stepsTotal,
        },
      };

    case 'STALL_WARNING': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = { ...existing, stallWarning: true };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      const stallWarnings = new Set(state.stallWarnings);
      stallWarnings.add(action.stepName);
      return { ...state, steps, stallWarnings };
    }

    case 'STEP_FAILED_ENRICHED': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = {
          ...existing,
          error: action.error,
          failures: action.failures,
          attempt: action.attempt,
        };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      return { ...state, steps };
    }

    case 'STEP_RETRY_CONTEXT': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = {
          ...existing,
          failures: action.previousFailures,
          attempt: action.attempt,
          retryHints: action.retryHints ?? existing.retryHints,
        };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      return { ...state, steps };
    }

    case 'STEP_RETRIES_EXHAUSTED': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = {
          ...existing,
          retriesExhausted: true,
          maxRetries: action.maxRetries,
          attempt: action.attempt,
          failures: action.failures,
        };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      return { ...state, steps };
    }

    case 'STEP_METRICS_MERGE': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        steps.set(action.stepName, { ...existing, mergeStrategy: action.mergeStrategy });
      }
      return { ...state, steps };
    }

    case 'STEP_MERGE_STATUS': {
      const steps = new Map(state.steps);
      const existing = steps.get(action.stepName);
      if (existing) {
        const updated = {
          ...existing,
          mergeStatus: action.status,
          mergeBranch: action.branch ?? existing.mergeBranch,
          mergeTargetBranch: action.targetBranch ?? existing.mergeTargetBranch,
          mergeError: action.error ?? existing.mergeError,
        };
        updated.escalation = deriveEscalation(updated, state.gates, state.questions);
        steps.set(action.stepName, updated);
      }
      return { ...state, steps };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBuildMonitor(runId: string | null): UseBuildMonitorReturn {
  const [state, dispatch] = useReducer(buildReducer, initialState);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);
  // Stable ref so the connect callback never becomes stale while capturing runId
  const runIdRef = useRef(runId);

  // Keep runId ref in sync
  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);

  const connect = useCallback(() => {
    const currentRunId = runIdRef.current;
    if (!currentRunId) return;

    // Close any existing connection before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `${API_BASE_URL}/runs/${currentRunId}/events`;
    console.log(`[useBuildMonitor] Connecting to SSE: ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[useBuildMonitor] SSE connected for run ${currentRunId}`);
      reconnectAttemptsRef.current = 0;
      dispatch({ type: 'SET_CONNECTED', connected: true });
    };

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        console.log(`[useBuildMonitor] SSE event: ${data.type}`);

        switch (data.type) {
          case 'ping':
            break;

          case 'run:status':
            dispatch({ type: 'RUN_STATUS', status: data.status as RunStatus, error: data.error });
            break;

          case 'step:status':
            dispatch({
              type: 'STEP_STATUS',
              stepName: data.step_name,
              status: data.status,
              output: data.output,
              error: data.error,
              attempt: data.attempt,
            });
            break;

          case 'gate:pending':
            dispatch({
              type: 'GATE_PENDING',
              gateId: data.gate_id,
              stepId: data.step_id,
              stepName: data.step_name,
            });
            break;

          case 'gate:approved':
          case 'gate:rejected':
            dispatch({
              type: 'GATE_DECIDED',
              gateId: data.gate_id,
              status: data.type === 'gate:approved' ? 'approved' : 'rejected',
              approver: data.approver,
              decisionNote: data.decision_note,
            });
            break;

          case 'question:pending':
            dispatch({
              type: 'QUESTION_PENDING',
              questionId: data.question_id,
              stepId: data.step_id,
              question: data.question,
            });
            break;

          case 'question:answered':
          case 'question:dismissed':
            dispatch({
              type: 'QUESTION_RESOLVED',
              questionId: data.question_id,
              status: data.type === 'question:answered' ? 'answered' : 'dismissed',
              answer: data.answer,
            });
            break;

          case 'step:scored':
            dispatch({
              type: 'STEP_SCORED',
              stepName: data.step_name,
              score: data.score,
              reasoning: data.reasoning,
              matchedCriteria: data.matched_criteria,
              failedCriteria: data.failed_criteria,
            });
            break;

          case 'step:metrics':
            dispatch({
              type: 'STEP_METRICS',
              stepName: data.step_name,
              model: data.model,
              durationMs: data.duration_ms,
              estimatedCostUsd: data.estimated_cost_usd,
            });
            if (data.merge_strategy) {
              dispatch({
                type: 'STEP_METRICS_MERGE',
                stepName: data.step_name,
                mergeStrategy: data.merge_strategy,
              });
            }
            break;

          case 'run:metrics':
            dispatch({
              type: 'RUN_METRICS',
              totalCostUsd: data.total_cost_usd,
              avgSatisfaction: data.avg_satisfaction,
              stepsCompleted: data.steps_completed,
              stepsTotal: data.steps_total,
            });
            break;

          case 'stall:warning':
            dispatch({ type: 'STALL_WARNING', stepName: data.step_name });
            break;

          case 'step:failed-enriched':
            dispatch({
              type: 'STEP_FAILED_ENRICHED',
              stepName: data.step_name,
              error: data.error,
              failures: data.failures,
              attempt: data.attempt,
            });
            break;

          case 'step:retry-context':
            dispatch({
              type: 'STEP_RETRY_CONTEXT',
              stepName: data.step_name,
              attempt: data.attempt,
              previousFailures: data.previous_failures,
              retryHints: data.retry_hints,
            });
            break;

          case 'step:retries-exhausted':
            dispatch({
              type: 'STEP_RETRIES_EXHAUSTED',
              stepName: data.step_name,
              attempt: data.attempt,
              maxRetries: data.max_retries,
              failures: data.failures,
            });
            break;

          case 'step:merge-status':
            dispatch({
              type: 'STEP_MERGE_STATUS',
              stepName: data.step_name,
              status: data.status,
              branch: data.branch,
              targetBranch: data.target_branch,
              error: data.error,
            });
            break;

          default:
            console.log(`[useBuildMonitor] Unknown event type: ${data.type}`);
        }
      } catch (err) {
        console.error(`[useBuildMonitor] Failed to parse SSE event:`, err, event.data);
      }
    };

    eventSource.onerror = () => {
      console.error(`[useBuildMonitor] SSE error for run ${currentRunId}`);
      eventSource.close();
      eventSourceRef.current = null;
      dispatch({ type: 'SET_CONNECTED', connected: false });

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        // Exponential backoff capped at 3× the base delay
        const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttemptsRef.current, 3);
        console.log(
          `[useBuildMonitor] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.error(`[useBuildMonitor] Max reconnect attempts reached for run ${currentRunId}`);
      }
    };

    eventSourceRef.current = eventSource;
  }, []); // No deps — reads runId via stable ref

  // Load current run state from REST on initial connection so the UI reflects
  // in-flight state for builds already underway when the user navigates here.
  // Response shape: { run: ForgeNextRun, gates: Gate[], questions: Question[] }
  // Step-level state is NOT in the REST response — it comes from SSE replay.
  const loadInitialState = useCallback(async (currentRunId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${currentRunId}`);
      if (!response.ok) {
        console.warn(`[useBuildMonitor] Initial state fetch returned ${response.status}`);
        return;
      }
      const data = (await response.json()) as {
        run: { status?: string; error?: string | null };
        gates?: Array<{
          id: string;
          step_id: string;
          step_name: string;
          status: string;
          approver?: string | null;
          decision_note?: string | null;
        }>;
        questions?: Array<{
          id: string;
          step_id: string;
          question: string;
          status: string;
          answer?: string | null;
        }>;
      };

      if (data.run?.status) {
        dispatch({ type: 'RUN_STATUS', status: data.run.status as RunStatus, error: data.run.error ?? undefined });
      }
      // Step status comes from SSE replay — not the REST endpoint.
      for (const gate of data.gates ?? []) {
        dispatch({
          type: 'GATE_PENDING',
          gateId: gate.id,
          stepId: gate.step_id,
          stepName: gate.step_name,
        });
        if (gate.status !== 'pending') {
          dispatch({
            type: 'GATE_DECIDED',
            gateId: gate.id,
            status: gate.status as 'approved' | 'rejected',
            approver: gate.approver,
            decisionNote: gate.decision_note,
          });
        }
      }
      for (const question of data.questions ?? []) {
        dispatch({
          type: 'QUESTION_PENDING',
          questionId: question.id,
          stepId: question.step_id,
          question: question.question,
        });
        if (question.status !== 'pending') {
          dispatch({
            type: 'QUESTION_RESOLVED',
            questionId: question.id,
            status: question.status as 'answered' | 'dismissed',
            answer: question.answer,
          });
        }
      }
    } catch (err) {
      console.warn(`[useBuildMonitor] Could not load initial run state:`, err);
    }
  }, []);

  // Connect / disconnect based on runId changes
  useEffect(() => {
    if (!runId) {
      // runId cleared — tear down and reset
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      clearTimeout(reconnectTimeoutRef.current);
      reconnectAttemptsRef.current = 0;
      dispatch({ type: 'RESET' });
      return;
    }

    // New runId — reset state then connect
    dispatch({ type: 'RESET' });
    reconnectAttemptsRef.current = 0;
    clearTimeout(reconnectTimeoutRef.current);

    loadInitialState(runId);
    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [runId, connect, loadInitialState]);

  // Derived values — computed outside render to avoid extra passes
  const pendingGateCount = useMemo(
    () => state.gates.filter((g) => g.status === 'pending').length,
    [state.gates]
  );

  const pendingQuestionCount = useMemo(
    () => state.questions.filter((q) => q.status === 'pending').length,
    [state.questions]
  );

  const stallWarnings = useMemo(
    () => [...state.stallWarnings],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.stallWarnings]
  );

  const isMonitoring =
    runId !== null && state.runStatus !== null && !TERMINAL_STATUSES.has(state.runStatus);

  return {
    runStatus: state.runStatus,
    steps: state.steps,
    gates: state.gates,
    questions: state.questions,
    connected: state.connected,
    runError: state.runError,
    isMonitoring,
    pendingGateCount,
    pendingQuestionCount,
    runMetrics: state.runMetrics,
    stallWarnings,
  };
}

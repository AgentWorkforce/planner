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

export interface StepState {
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
  output?: string;
  error?: string;
  attempt?: number;
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
    };

interface BuildState {
  runStatus: RunStatus | null;
  runError: string | null;
  steps: Map<string, StepState>;
  gates: GateState[];
  questions: QuestionState[];
  connected: boolean;
}

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set(['completed', 'failed', 'cancelled']);

const initialState: BuildState = {
  runStatus: null,
  runError: null,
  steps: new Map(),
  gates: [],
  questions: [],
  connected: false,
};

function buildReducer(state: BuildState, action: BuildAction): BuildState {
  switch (action.type) {
    case 'RESET':
      return { ...initialState };

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
      next.set(action.stepName, {
        stepName: action.stepName,
        status: action.status,
        output: action.output ?? existing?.output,
        error: action.error ?? existing?.error,
        attempt: action.attempt ?? existing?.attempt,
      });
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
      return { ...state, gates: [...state.gates, newGate] };
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
      return { ...state, gates };
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
      return { ...state, questions: [...state.questions, newQuestion] };
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
      return { ...state, questions };
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
  };
}

const FORGE_API = '/api/forge-next';

export interface StepOverride {
  step_id: string;
  model?: 'haiku' | 'sonnet' | 'opus';
  skip?: boolean;
}

export interface ForgeConfig {
  workspace_path?: string;
  step_overrides: StepOverride[];
  execution_policy: {
    parallelism?: {
      max_concurrent_tasks?: number;
      max_concurrent_per_scope?: number;
      prefer_sequential_in_scope?: boolean;
    };
    budgets?: {
      total_cost_limit_usd?: number;
    };
  };
}

export interface StartBuildRequest {
  plan_id: string;
  plan_version?: number;
  workspace_path?: string;
  execution_policy?: ForgeConfig['execution_policy'];
  step_overrides?: StepOverride[];
}

export interface StartBuildResponse {
  run_id: string;
  status: string;
  tasks_count?: number;
}

export interface Gate {
  id: string;
  run_id: string;
  step_id: string;
  step_name: string;
  status: 'pending' | 'approved' | 'rejected';
  approver: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface AgentQuestion {
  id: string;
  run_id: string;
  step_id: string;
  agent_id: string | null;
  question: string;
  answer: string | null;
  status: 'pending' | 'answered' | 'dismissed';
  created_at: string;
  answered_at: string | null;
}

export interface RunDetails {
  run: {
    id: string;
    plan_id: string;
    plan_version: number;
    relay_run_id: string | null;
    status: string;
    config: string;
    workflow_config: string | null;
    error: string | null;
    created_at: string;
    updated_at: string;
  };
  gates: Gate[];
  questions: AgentQuestion[];
}

// -- Build --

export async function startBuild(request: StartBuildRequest): Promise<StartBuildResponse> {
  const response = await fetch(`${FORGE_API}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to start build: ${response.status}`);
  }

  return response.json() as Promise<StartBuildResponse>;
}

// -- Run details --

export async function getRunDetails(runId: string): Promise<RunDetails> {
  const response = await fetch(`${FORGE_API}/runs/${runId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to fetch run: ${response.status}`);
  }

  return response.json() as Promise<RunDetails>;
}

// -- Run control --

export async function pauseRun(runId: string): Promise<{ run_id: string; status: string }> {
  const response = await fetch(`${FORGE_API}/runs/${runId}/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to pause run: ${response.status}`);
  }

  return response.json() as Promise<{ run_id: string; status: string }>;
}

export async function resumeRun(runId: string): Promise<{ run_id: string; status: string }> {
  const response = await fetch(`${FORGE_API}/runs/${runId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to resume run: ${response.status}`);
  }

  return response.json() as Promise<{ run_id: string; status: string }>;
}

export async function cancelRun(runId: string): Promise<{ run_id: string; status: string }> {
  const response = await fetch(`${FORGE_API}/runs/${runId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to cancel run: ${response.status}`);
  }

  return response.json() as Promise<{ run_id: string; status: string }>;
}

// -- Gates --

export async function listGates(runId: string): Promise<Gate[]> {
  const response = await fetch(`${FORGE_API}/runs/${runId}/gates`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to list gates: ${response.status}`);
  }

  const data = await response.json() as { gates: Gate[] };
  return data.gates;
}

export async function approveGate(gateId: string, approver?: string, note?: string): Promise<Gate> {
  const response = await fetch(`${FORGE_API}/gates/${gateId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, note }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to approve gate: ${response.status}`);
  }

  const data = await response.json() as { gate: Gate };
  return data.gate;
}

export async function rejectGate(gateId: string, approver?: string, note?: string): Promise<Gate> {
  const response = await fetch(`${FORGE_API}/gates/${gateId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver, note }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to reject gate: ${response.status}`);
  }

  const data = await response.json() as { gate: Gate };
  return data.gate;
}

// -- Questions --

export async function listQuestions(runId: string, status?: string): Promise<AgentQuestion[]> {
  const url = new URL(`${FORGE_API}/runs/${runId}/questions`, window.location.origin);
  if (status) url.searchParams.set('status', status);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to list questions: ${response.status}`);
  }

  const data = await response.json() as { questions: AgentQuestion[] };
  return data.questions;
}

export async function answerQuestion(questionId: string, answer: string): Promise<AgentQuestion> {
  const response = await fetch(`${FORGE_API}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to answer question: ${response.status}`);
  }

  const data = await response.json() as { question: AgentQuestion };
  return data.question;
}

export async function dismissQuestion(questionId: string): Promise<AgentQuestion> {
  const response = await fetch(`${FORGE_API}/questions/${questionId}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as { error?: string }).error || `Failed to dismiss question: ${response.status}`);
  }

  const data = await response.json() as { question: AgentQuestion };
  return data.question;
}

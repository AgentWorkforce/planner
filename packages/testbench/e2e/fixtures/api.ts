/**
 * API helper for seeding test data directly via HTTP.
 *
 * Tests use this to create plans, sessions, runs etc. before
 * asserting on the UI. This avoids fragile UI-driven setup.
 */

const API_BASE = 'http://localhost:3001';

async function post(path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function get(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function put(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function del(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function patch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// =============================================================================
// Planner API
// =============================================================================

export interface CreatedPlan {
  plan_id: string;
  version: number;
  status: string;
  summary: { goal: string; context?: string };
  steps: Array<{
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    dependencies?: string[];
    owner_role?: string;
    acceptance_criteria?: Array<{ id: string; description: string }>;
  }>;
}

export async function createPlan(goal: string, context?: string): Promise<CreatedPlan> {
  const data = await post('/api/plans', { goal, context });
  // API returns { plan: {...}, version: {...} } — normalize to flat shape
  if (data.plan && data.version) {
    return {
      plan_id: data.plan.plan_id,
      version: data.version.version,
      status: data.version.status,
      summary: data.version.summary ?? { goal },
      steps: data.version.steps ?? [],
    };
  }
  return data.data ?? data;
}

export async function getPlan(planId: string): Promise<CreatedPlan> {
  const data = await get(`/api/plans/${planId}`);
  // API returns { plan: {...}, version: {...} } — normalize to flat shape
  if (data.plan && data.version) {
    return {
      plan_id: data.plan.plan_id,
      version: data.version.version,
      status: data.version.status,
      summary: data.version.summary,
      steps: data.version.steps ?? [],
    };
  }
  return data.data ?? data;
}

export async function listPlans(): Promise<{ plans: CreatedPlan[] }> {
  return get('/api/plans');
}

export async function createVersion(planId: string, steps: unknown[]) {
  return post(`/api/plans/${planId}/versions`, { steps });
}

export async function submitPlan(planId: string, version: number) {
  return post(`/api/plans/${planId}/versions/${version}/submit`);
}

export async function approvePlan(planId: string, version: number) {
  return post(`/api/plans/${planId}/versions/${version}/approve`, { approver: 'test-user' });
}

export async function publishPlan(planId: string, version: number) {
  return post(`/api/plans/${planId}/versions/${version}/publish`);
}

export async function updatePlan(planId: string, fields: Record<string, unknown>) {
  return put(`/api/plans/${planId}`, fields);
}

/**
 * Poll until the plan's version number stabilizes (AI version generation complete).
 * Returns the latest stable version.
 */
export async function waitForStableVersion(planId: string, maxWaitMs = 8000): Promise<CreatedPlan> {
  const start = Date.now();
  let lastVersion = -1;
  let stableSince = 0;

  while (Date.now() - start < maxWaitMs) {
    const plan = await getPlan(planId);
    if (plan.version !== lastVersion) {
      lastVersion = plan.version;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= 1500) {
      // Version hasn't changed for 1.5s — stable
      return plan;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Return whatever we have
  return getPlan(planId);
}

// =============================================================================
// Initiative API
// =============================================================================

export interface CreatedInitiative {
  id: string;
  name: string;
  status: string;
  description?: string;
}

export async function createInitiative(name: string, description?: string): Promise<CreatedInitiative> {
  const data = await post('/api/initiatives', { name, description });
  // API returns { initiative_id, name, ... } — normalize id field
  const raw = data.data ?? data;
  return {
    id: raw.id ?? raw.initiative_id,
    name: raw.name,
    status: raw.status,
    description: raw.description,
  };
}

export async function listInitiatives(): Promise<{ data: CreatedInitiative[] }> {
  return get('/api/initiatives');
}

export async function updateInitiative(id: string, fields: Record<string, unknown>) {
  return put(`/api/initiatives/${id}`, fields);
}

export async function deleteInitiative(id: string) {
  return del(`/api/initiatives/${id}`);
}

// =============================================================================
// Ideation API
// =============================================================================

export interface CreatedSession {
  id: string;
  status: string;
  source: { type: string; initial_intent: string };
}

export async function createIdeationSession(initialIntent: string, initiativeId?: string): Promise<CreatedSession> {
  const body: Record<string, unknown> = { initial_intent: initialIntent };
  if (initiativeId) body.initiative_id = initiativeId;
  const data = await post('/api/ideation/sessions', body);
  return data.data ?? data;
}

export async function getIdeationSession(sessionId: string) {
  const data = await get(`/api/ideation/sessions/${sessionId}`);
  return data.data ?? data;
}

export async function listIdeationSessions() {
  return get('/api/ideation/sessions');
}

export async function addIdeationMessage(sessionId: string, role: string, content: string) {
  return post(`/api/ideation/sessions/${sessionId}/messages`, { role, content });
}

export async function createBlock(
  sessionId: string,
  block: { type: string; title: string; keyword: string; emoji: string; content?: string }
) {
  const data = await post(`/api/ideation/sessions/${sessionId}/blocks`, block);
  return data.data ?? data;
}

export async function curateBlock(sessionId: string, blockId: string) {
  return post(`/api/ideation/sessions/${sessionId}/blocks/${blockId}/curate`);
}

export async function sendToPlanner(sessionId: string, options?: { goal?: string; context?: string }) {
  return post(`/api/ideation/sessions/${sessionId}/send-to-planner`, options ?? {});
}

// =============================================================================
// Forge API
// =============================================================================

export interface CreatedRun {
  run_id: string;
  status: string;
  plan_id: string;
}

export async function createForgeRun(plan: {
  plan_id: string;
  version: number;
  summary: { goal: string };
  steps: Array<{
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    dependencies?: string[];
    owner_role?: string;
    acceptance_criteria?: Array<{ id: string; description: string }>;
  }>;
}): Promise<CreatedRun> {
  const data = await post('/api/forge/runs', { plan });
  return data.data ?? data;
}

export async function getForgeRun(runId: string) {
  const data = await get(`/api/forge/runs/${runId}`);
  return data.data ?? data;
}

export async function listForgeRuns() {
  return get('/api/forge/runs');
}

// =============================================================================
// Comment API
// =============================================================================

export async function createComment(
  planId: string,
  version: number,
  body: { step_id?: string; body: string; author?: string }
) {
  return post(`/api/plans/${planId}/versions/${version}/comments`, body);
}

export async function listComments(planId: string, version: number) {
  return get(`/api/plans/${planId}/versions/${version}/comments`);
}

export async function resolveComment(planId: string, version: number, commentId: string) {
  return post(`/api/plans/${planId}/versions/${version}/comments/${commentId}/resolve`);
}

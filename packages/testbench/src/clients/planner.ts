import { fetchWithRetry } from '../util/fetch-retry.js';

/**
 * Step type for testbench use. Mirrors planner-core's Step type.
 * Kept local to avoid build-time dependency on planner package.
 * Note: dependencies has a default in planner schema, so optional here.
 */
export interface Step {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies?: string[];
  owner_role?: string;
  acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
  complexity_estimate?: { score: number; level: string };
}

export interface CreatePlanResult {
  plan_id: string;
  version: number;
}

export interface PlanVersionResult {
  plan_id: string;
  version: number;
  status: string;
  summary: { goal: string; context?: string };
  steps: Array<{
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    owner_role?: string;
    dependencies: string[];
    acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
    complexity_estimate?: { score: number; level: string };
  }>;
}

export class PlannerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Update plan with steps. Creates a new version with the provided steps.
   * Only works on draft versions.
   * Returns the new version number.
   */
  async updatePlanSteps(planId: string, steps: Step[]): Promise<{ version: number }> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans/${planId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Planner updatePlanSteps failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { version: { version: number } };
    return { version: data.version.version };
  }

  async createPlan(goal: string): Promise<CreatePlanResult> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Planner createPlan failed: ${res.status} ${await res.text()}`);
    }

    // Planner returns { plan: { plan_id, ... }, version: { version, ... } }
    const data = await res.json() as { plan: { plan_id: string }; version: { version: number } };
    return {
      plan_id: data.plan.plan_id,
      version: data.version.version,
    };
  }

  async getPlanVersion(planId: string, version: number): Promise<PlanVersionResult> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans/${planId}/versions/${version}`,
      undefined,
      { maxRetries: 3, initialDelay: 200, maxDelay: 2000 }
    );
    if (!res.ok) {
      throw new Error(`Planner getPlanVersion failed: ${res.status} ${await res.text()}`);
    }

    // Planner returns { version: { plan_id, version, status, summary, steps, ... } }
    const data = await res.json() as { version: PlanVersionResult };
    return data.version;
  }

  async submitPlan(planId: string, version: number): Promise<void> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans/${planId}/versions/${version}/submit`,
      { method: 'POST' },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Planner submitPlan failed: ${res.status} ${await res.text()}`);
    }
  }

  async approvePlan(planId: string, version: number): Promise<void> {
    // Must submit before approving
    await this.submitPlan(planId, version);

    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans/${planId}/versions/${version}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver: 'testbench' }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Planner approvePlan failed: ${res.status} ${await res.text()}`);
    }
  }

  async publishPlan(planId: string, version: number): Promise<{ plan_ref: string }> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans/${planId}/versions/${version}/publish`,
      { method: 'POST' },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Planner publishPlan failed: ${res.status} ${await res.text()}`);
    }

    // Planner returns { version, plan_ref, dot_summary, ... }
    const data = await res.json() as { plan_ref: string };
    return { plan_ref: data.plan_ref };
  }

  async getLatestVersion(planId: string): Promise<PlanVersionResult> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/plans/${planId}`,
      undefined,
      { maxRetries: 3, initialDelay: 200, maxDelay: 2000 }
    );
    if (!res.ok) {
      throw new Error(`getLatestVersion failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { plan: unknown; version: PlanVersionResult };
    return data.version;
  }

  async waitForSteps(
    planId: string,
    options?: { timeout_ms?: number; poll_interval_ms?: number }
  ): Promise<PlanVersionResult> {
    const timeout = options?.timeout_ms ?? 90_000;
    const interval = options?.poll_interval_ms ?? 3_000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const latest = await this.getLatestVersion(planId);
      if (latest && latest.steps.length > 0) {
        return latest;
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`PlannerLead did not generate steps within ${timeout / 1000}s`);
  }
}

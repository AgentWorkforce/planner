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

  async createPlan(goal: string): Promise<CreatePlanResult> {
    const res = await fetch(`${this.baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    });

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
    const res = await fetch(`${this.baseUrl}/api/plans/${planId}/versions/${version}`);
    if (!res.ok) {
      throw new Error(`Planner getPlanVersion failed: ${res.status} ${await res.text()}`);
    }

    // Planner returns { version: { plan_id, version, status, summary, steps, ... } }
    const data = await res.json() as { version: PlanVersionResult };
    return data.version;
  }

  async submitPlan(planId: string, version: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/plans/${planId}/versions/${version}/submit`, {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error(`Planner submitPlan failed: ${res.status} ${await res.text()}`);
    }
  }

  async approvePlan(planId: string, version: number): Promise<void> {
    // Must submit before approving
    await this.submitPlan(planId, version);

    const res = await fetch(`${this.baseUrl}/api/plans/${planId}/versions/${version}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver: 'testbench' }),
    });

    if (!res.ok) {
      throw new Error(`Planner approvePlan failed: ${res.status} ${await res.text()}`);
    }
  }

  async publishPlan(planId: string, version: number): Promise<{ plan_ref: string }> {
    const res = await fetch(`${this.baseUrl}/api/plans/${planId}/versions/${version}/publish`, {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error(`Planner publishPlan failed: ${res.status} ${await res.text()}`);
    }

    // Planner returns { version, plan_ref, dot_summary, ... }
    const data = await res.json() as { plan_ref: string };
    return { plan_ref: data.plan_ref };
  }
}

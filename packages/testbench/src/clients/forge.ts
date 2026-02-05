/**
 * ForgePlan shape matching forge-core's ForgePlanSchema.
 * Passed inline to POST /runs.
 */
export interface ForgePlan {
  plan_id: string;
  version: number;
  summary: { goal: string; context?: string };
  steps: Array<{
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    owner_role?: string;
    dependencies: string[];
    acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
  }>;
}

export interface CreateRunResult {
  run_id: string;
  status: string;
}

export interface RunStatus {
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  tasks_total?: number;
  tasks_completed?: number;
  tasks_failed?: number;
  started_at?: string;
  completed_at?: string;
  total_tokens?: number;
  total_cost_usd?: number;
}

export class ForgeClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async createRun(plan: ForgePlan, workspacePath?: string): Promise<CreateRunResult> {
    const res = await fetch(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        workspace_path: workspacePath,
      }),
    });

    if (!res.ok) {
      throw new Error(`Forge createRun failed: ${res.status} ${await res.text()}`);
    }

    return res.json() as Promise<CreateRunResult>;
  }

  async getRun(runId: string): Promise<RunStatus> {
    const res = await fetch(`${this.baseUrl}/runs/${runId}`);
    if (!res.ok) {
      throw new Error(`Forge getRun failed: ${res.status} ${await res.text()}`);
    }

    // Forge returns tasks_count, map to tasks_total for consistency
    const data = (await res.json()) as Record<string, unknown>;
    return {
      run_id: data.run_id as string,
      status: data.status as RunStatus['status'],
      tasks_total: (data.tasks_count ?? data.tasks_total) as number | undefined,
      tasks_completed: data.tasks_completed as number | undefined,
      tasks_failed: data.tasks_failed as number | undefined,
      started_at: data.started_at as string | undefined,
      completed_at: data.completed_at as string | undefined,
      total_tokens: data.total_tokens as number | undefined,
      total_cost_usd: data.total_cost_usd as number | undefined,
    };
  }

  async pollUntilComplete(
    runId: string,
    options?: { interval_ms?: number; timeout_ms?: number }
  ): Promise<RunStatus> {
    const interval = options?.interval_ms ?? 2000;
    const timeout = options?.timeout_ms ?? 30 * 60 * 1000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const status = await this.getRun(runId);

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Forge run ${runId} timed out after ${timeout / 1000}s`);
  }
}

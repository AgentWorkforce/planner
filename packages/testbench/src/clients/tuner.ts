export interface TaskOutcome {
  task_id: string;
  run_id: string;
  success: boolean;
  tokens_used: number;
  cost_usd: number;
  duration_seconds: number;
  model_id?: string;
}

export class TunerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getOutcomes(runId: string): Promise<TaskOutcome[]> {
    const res = await fetch(`${this.baseUrl}/api/tuner/outcomes?run_id=${encodeURIComponent(runId)}`);

    if (!res.ok) {
      throw new Error(`Tuner getOutcomes failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return (data as { outcomes: TaskOutcome[] }).outcomes ?? (data as TaskOutcome[]);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

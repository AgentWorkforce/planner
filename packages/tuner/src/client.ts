/**
 * TunerClient for Forge/Planner integration.
 * To be fully implemented in t017.
 */

import type { ForgeExecutionConfig, PlannerConfig } from './domain/config.js';
import type { TaskOutcome, RunOutcome } from './domain/outcome.js';

export class TunerClient {
  constructor(private baseUrl: string) {}

  async getForgeConfig(): Promise<ForgeExecutionConfig> {
    const res = await fetch(`${this.baseUrl}/api/tuner/config/forge`);
    return res.json() as Promise<ForgeExecutionConfig>;
  }

  async getPlannerConfig(): Promise<PlannerConfig> {
    const res = await fetch(`${this.baseUrl}/api/tuner/config/planner`);
    return res.json() as Promise<PlannerConfig>;
  }

  async recordTaskOutcome(outcome: TaskOutcome): Promise<void> {
    fetch(`${this.baseUrl}/api/tuner/outcomes/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcome),
    }).catch((err) => {
      console.error('[TunerClient] Failed to record task outcome:', err.message);
    });
  }

  async recordRunOutcome(outcome: RunOutcome): Promise<void> {
    fetch(`${this.baseUrl}/api/tuner/outcomes/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcome),
    }).catch((err) => {
      console.error('[TunerClient] Failed to record run outcome:', err.message);
    });
  }
}

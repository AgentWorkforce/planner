/**
 * Agent Lifecycle Manager
 *
 * Manages spawning and releasing of domain-specific agents.
 * Each entity (session, plan) gets its own agent instance.
 */

import {
  spawnAgent,
  releaseAgent,
  isAgentSpawned,
  getSpawnedAgents,
} from '../relay/client.js';
import { interviewerPrompt } from './prompts/interviewer.js';
import { plannerLeadPrompt } from './prompts/planner-lead.js';

interface AgentInfo {
  name: string;
  type: 'interviewer' | 'planner-lead';
  entityId: string;
  spawnedAt: Date;
}

const managedAgents = new Map<string, AgentInfo>();

function interviewerName(sessionId: string): string {
  return `Interviewer-${sessionId.slice(0, 8)}`;
}

function plannerLeadName(planId: string): string {
  return `PlannerLead-${planId.slice(0, 8)}`;
}

export interface LifecycleManagerOptions {
  mcpServerUrl?: string;
}

export class AgentLifecycleManager {
  private mcpServerUrl: string;
  private spawning = new Set<string>();

  constructor(options: LifecycleManagerOptions = {}) {
    this.mcpServerUrl = options.mcpServerUrl || 'http://localhost:3001';
  }

  async spawnInterviewer(sessionId: string, context?: { goal?: string; transcriptSummary?: string }): Promise<void> {
    const name = interviewerName(sessionId);

    if (isAgentSpawned(name) || this.spawning.has(name)) {
      console.log(`[lifecycle] Interviewer ${name} already spawned or spawning, skipping`);
      return;
    }

    this.spawning.add(name);
    try {
      const task = interviewerPrompt(sessionId, {
        goal: context?.goal,
        mcpServerUrl: this.mcpServerUrl,
        transcriptSummary: context?.transcriptSummary,
      });

      const channelId = `#ideation-${sessionId.slice(0, 8)}`;
      console.log(`[lifecycle] Spawning Interviewer ${name} for session ${sessionId} (channel: ${channelId})`);
      const result = await spawnAgent({
        name,
        task,
        cli: 'claude',
        cwd: process.cwd(),
        channels: [channelId],
      });

      if (result.success) {
        managedAgents.set(name, {
          name,
          type: 'interviewer',
          entityId: sessionId,
          spawnedAt: new Date(),
        });
        console.log(`[lifecycle] Interviewer ${name} spawned (pid: ${result.pid})`);
      } else {
        console.error(`[lifecycle] Failed to spawn Interviewer ${name}: ${result.error}`);
      }
    } finally {
      this.spawning.delete(name);
    }
  }

  async warmInterviewer(sessionId: string, context?: { goal?: string; transcriptSummary?: string }): Promise<void> {
    console.log(`[lifecycle] Warming Interviewer for session ${sessionId}`);
    await this.spawnInterviewer(sessionId, context);
  }

  async spawnPlannerLead(planId: string, context?: { goal?: string }): Promise<void> {
    const name = plannerLeadName(planId);

    if (isAgentSpawned(name) || this.spawning.has(name)) {
      console.log(`[lifecycle] PlannerLead ${name} already spawned or spawning, skipping`);
      return;
    }

    this.spawning.add(name);
    try {
      const task = plannerLeadPrompt(planId, {
        goal: context?.goal,
        mcpServerUrl: this.mcpServerUrl,
      });

      console.log(`[lifecycle] Spawning PlannerLead ${name} for plan ${planId}`);
      const result = await spawnAgent({
        name,
        task,
        cli: 'claude',
        planId,
        cwd: process.cwd(),
      });

      if (result.success) {
        managedAgents.set(name, {
          name,
          type: 'planner-lead',
          entityId: planId,
          spawnedAt: new Date(),
        });
        console.log(`[lifecycle] PlannerLead ${name} spawned (pid: ${result.pid})`);
      } else {
        console.error(`[lifecycle] Failed to spawn PlannerLead ${name}: ${result.error}`);
      }
    } finally {
      this.spawning.delete(name);
    }
  }

  async release(name: string): Promise<void> {
    console.log(`[lifecycle] Releasing agent ${name}`);
    await releaseAgent(name);
    managedAgents.delete(name);
  }

  async releaseAll(): Promise<void> {
    console.log(`[lifecycle] Releasing all managed agents (${managedAgents.size})`);
    const names = Array.from(managedAgents.keys());
    await Promise.allSettled(names.map((name) => this.release(name)));
  }

  getActiveAgents(): AgentInfo[] {
    return Array.from(managedAgents.values());
  }

  isManaged(name: string): boolean {
    return managedAgents.has(name);
  }
}

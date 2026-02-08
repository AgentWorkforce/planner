import type { Request, Response } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { Task } from '../../domain/types.js';
import { TaskStatus } from '../../domain/types.js';
import {
  ListActiveAgentsQuerySchema,
  type ListActiveAgentsResponse,
  type ActiveAgent,
} from '../schemas.js';

// ============================================
// Types
// ============================================

/**
 * Agent presence information from agent tracking system.
 */
export interface AgentPresence {
  agent_id: string;
  last_heartbeat: string;
  status: 'active' | 'stale' | 'disconnected';
}

/**
 * Function to get agent presence information.
 */
export type GetAgentPresenceFn = () => AgentPresence[];

/**
 * Dependencies for agent handlers.
 */
export interface AgentHandlerDeps {
  storage: ForgeStorage;
  getAgentPresence?: GetAgentPresenceFn;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Converts a running task to an ActiveAgent entry.
 */
function taskToActiveAgent(task: Task, presence?: AgentPresence): ActiveAgent {
  return {
    agent_id: task.agent_id ?? 'unknown',
    run_id: task.run_id,
    task_id: task.task_id,
    status: presence?.status ?? 'active',
    last_heartbeat: presence?.last_heartbeat,
    current_task_title: task.step_title,
  };
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for GET /agents
 *
 * Returns a merged view of agent presence and task state.
 * Shows all agents currently working on tasks across all runs.
 */
export function listActiveAgentsHandler(deps: AgentHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      // Validate query parameters
      const queryResult = ListActiveAgentsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;

      // Get all running tasks
      let runningTasks: Task[] = [];

      if (query.run_id) {
        // Filter by specific run
        const allTasks = deps.storage.listTasksByRun(query.run_id);
        runningTasks = allTasks.filter(
          (t) => t.status === TaskStatus.Running && t.agent_id
        );
      } else {
        // Get all active runs and their running tasks
        const activeRuns = deps.storage.getActiveRuns();
        for (const run of activeRuns) {
          const tasks = deps.storage.listTasksByRun(run.run_id);
          const running = tasks.filter(
            (t) => t.status === TaskStatus.Running && t.agent_id
          );
          runningTasks.push(...running);
        }
      }

      // Get agent presence information if available
      const presenceMap = new Map<string, AgentPresence>();
      if (deps.getAgentPresence) {
        const presenceList = deps.getAgentPresence();
        for (const presence of presenceList) {
          presenceMap.set(presence.agent_id, presence);
        }
      }

      // Merge task info with presence info
      const agents: ActiveAgent[] = runningTasks.map((task) => {
        const presence = task.agent_id
          ? presenceMap.get(task.agent_id)
          : undefined;
        return taskToActiveAgent(task, presence);
      });

      // Also include agents from presence that might not have tasks yet
      // (agents that were spawned but haven't started a task)
      if (deps.getAgentPresence && !query.run_id) {
        const taskAgentIds = new Set(runningTasks.map((t) => t.agent_id));
        const presenceList = deps.getAgentPresence();
        for (const presence of presenceList) {
          if (
            presence.status === 'active' &&
            !taskAgentIds.has(presence.agent_id)
          ) {
            // Agent is active but not assigned to a task - might be initializing
            agents.push({
              agent_id: presence.agent_id,
              run_id: '', // Unknown
              task_id: '', // Unknown
              status: presence.status,
              last_heartbeat: presence.last_heartbeat,
              current_task_title: 'Initializing...',
            });
          }
        }
      }

      const response: ListActiveAgentsResponse = {
        agents,
        total: agents.length,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[AgentHandler] Error listing active agents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type ListActiveAgentsHandlerFn = ReturnType<typeof listActiveAgentsHandler>;

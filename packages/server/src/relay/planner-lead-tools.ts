/**
 * PlannerLead Tool Definitions and Handlers
 *
 * Defines the tools available to PlannerLead for Anthropic API tool use.
 * Includes both schema definitions and execution handlers.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { PlanStorage } from '../../../planner/src/storage/interface.js';
import type { Plan, PlanVersion } from '../../../planner/src/domain/plan.js';
import type { Step } from '../../../planner/src/domain/step.js';
import { createQuestion as createQuestionEntity } from '../../../planner/src/domain/question.js';
import { randomUUID } from 'crypto';
import { emitPlanChange } from '../../../planner/src/events/plan-events.js';
import { emitQuestionEvent } from '../../../planner/src/events/question-events.js';
import {
  spawnAgent,
  releaseAgent,
  sendMessage,
  getSpawnedAgents,
  isAgentSpawned,
  getClient,
} from './client.js';
import {
  emitAgentJoined,
  emitAgentStatusUpdate,
  getActiveAgents,
  type AgentRole,
  type AgentState,
} from './agent-status.js';

/**
 * Find a plan by ID or ID prefix.
 * Channel names only contain 8 characters of the UUID (e.g., #plan-042265be),
 * so we need to resolve the prefix to the full plan ID.
 */
function findPlanByIdPrefix(storage: PlanStorage, idPrefix: string): Plan | null {
  // If it looks like a full UUID, try direct lookup first
  if (idPrefix.length >= 32) {
    return storage.getPlan(idPrefix);
  }

  // Search by prefix
  const plans = storage.listPlans();
  const match = plans.find((p) => p.plan_id.startsWith(idPrefix));
  return match || null;
}

/** Tool result type */
export interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Tool schemas in Anthropic API format.
 */
export const PLANNER_LEAD_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_plan',
    description: 'Read a plan to see its current state including goal, status, and steps. Use this when a user asks about a specific plan or you need context about what the plan contains.',
    input_schema: {
      type: 'object' as const,
      properties: {
        plan_id: {
          type: 'string',
          description: 'The ID of the plan to read',
        },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'list_plans',
    description: 'List all plans, optionally filtered by status. Use this when a user asks what plans exist or wants to see available plans.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'approved', 'published'],
          description: 'Optional status filter',
        },
      },
      required: [],
    },
  },
  {
    name: 'add_step',
    description: 'Add a new step to a draft plan. Only works on draft plans. Use when a user asks to add a task, step, or action item to a plan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        plan_id: {
          type: 'string',
          description: 'The ID of the plan to add a step to',
        },
        title: {
          type: 'string',
          description: 'The title of the new step',
        },
        description: {
          type: 'string',
          description: 'Optional description of what the step involves',
        },
        scope: {
          type: 'string',
          description: 'Optional scope (e.g., "backend", "frontend")',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of step IDs this step depends on',
        },
      },
      required: ['plan_id', 'title'],
    },
  },
  {
    name: 'edit_step',
    description: 'Modify an existing step in a draft plan. Only works on draft plans. Use when a user asks to change, update, or fix a step.',
    input_schema: {
      type: 'object' as const,
      properties: {
        plan_id: {
          type: 'string',
          description: 'The ID of the plan containing the step',
        },
        step_id: {
          type: 'string',
          description: 'The ID of the step to edit',
        },
        title: {
          type: 'string',
          description: 'New title for the step (optional)',
        },
        description: {
          type: 'string',
          description: 'New description for the step (optional)',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'New dependencies array (optional)',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'spawn_agent',
    description:
      'Spawn a worker agent to perform a specific task. Use this when you need another agent to help with implementation, code review, research, or other work. The spawned agent runs as a separate process and can be communicated with via relay messaging.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description:
            'Unique name for the agent (e.g., "impl-worker-1", "code-reviewer"). Must be unique across all active agents.',
        },
        task: {
          type: 'string',
          description:
            'Task description that will be included in the agent system prompt. Be specific about what the agent should do.',
        },
        cwd: {
          type: 'string',
          description:
            'Working directory for the agent (optional). Defaults to the current project directory.',
        },
        initial_message: {
          type: 'string',
          description:
            'Optional message to send to the agent immediately after spawning.',
        },
      },
      required: ['name', 'task'],
    },
  },
  {
    name: 'release_agent',
    description:
      'Release (terminate) a previously spawned agent. Use this when an agent has completed its task and is no longer needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the agent to release',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'message_agent',
    description:
      'Send a message to another agent. Use this to communicate with spawned worker agents or other agents in the relay.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_name: {
          type: 'string',
          description: 'Name of the agent to message',
        },
        message: {
          type: 'string',
          description: 'Message content to send',
        },
      },
      required: ['agent_name', 'message'],
    },
  },
  {
    name: 'list_agents',
    description:
      'List all agents that have been spawned by PlannerLead and are currently active.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // === MCP Unified Interface Tools ===
  // These tools provide unified agent management across all agents (persistent and spawned)
  {
    name: 'report_agent_status',
    description:
      'Report your agent status to the system. On first call, registers the agent with display name and role. Subsequent calls update state. Call this immediately on startup, and whenever your state changes (working, needs_input, idle, error).',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Unique identifier for this agent instance',
        },
        role: {
          type: 'string',
          enum: ['planner-lead', 'architect', 'ui-designer', 'data-modeler', 'coder', 'tester', 'security'],
          description: 'Agent role in the system',
        },
        display_name: {
          type: 'string',
          description: 'Human-readable name shown in UI (required on first call)',
        },
        state: {
          type: 'string',
          enum: ['idle', 'working', 'needs_input', 'error'],
          description: 'Current agent state',
        },
        activity: {
          type: 'string',
          description: 'Optional current activity description',
        },
        thought: {
          type: 'string',
          description: 'Optional current thought/reasoning to display',
        },
      },
      required: ['agent_id', 'role', 'state'],
    },
  },
  {
    name: 'ask_user_question',
    description:
      'Submit a question to the user question queue. This creates a question entry visible in the UI and automatically sets your agent state to needs_input. Use when you need user input to proceed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Your agent identifier',
        },
        agent_role: {
          type: 'string',
          description: 'Your agent role (e.g., "architect", "coder")',
        },
        plan_id: {
          type: 'string',
          description: 'ID of the plan this question relates to',
        },
        text: {
          type: 'string',
          description: 'The question to ask the user',
        },
        context: {
          type: 'string',
          description: 'Optional additional context for the question',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional predefined answer options',
        },
        blocking_level: {
          type: 'string',
          enum: ['hard_block', 'soft_block', 'preference', 'fyi'],
          description: 'How severely this question blocks progress (default: soft_block)',
        },
      },
      required: ['agent_id', 'agent_role', 'plan_id', 'text'],
    },
  },
  {
    name: 'join_plan_channel',
    description:
      'Join the relay channel for a specific plan. This enables you to send and receive messages in the plan channel for real-time collaboration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Your agent identifier',
        },
        plan_id: {
          type: 'string',
          description: 'ID of the plan channel to join',
        },
      },
      required: ['agent_id', 'plan_id'],
    },
  },
];

/**
 * Execute a tool by name with given input.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  storage: PlanStorage
): Promise<ToolResult> {
  switch (toolName) {
    case 'read_plan':
      return executeReadPlan(input as unknown as { plan_id: string }, storage);
    case 'list_plans':
      return executeListPlans(input as unknown as { status?: string }, storage);
    case 'add_step':
      return executeAddStep(input as unknown as AddStepInput, storage);
    case 'edit_step':
      return executeEditStep(input as unknown as EditStepInput, storage);
    case 'spawn_agent':
      return executeSpawnAgent(input as unknown as SpawnAgentInput);
    case 'release_agent':
      return executeReleaseAgent(input as unknown as { name: string });
    case 'message_agent':
      return executeMessageAgent(input as unknown as MessageAgentInput);
    case 'list_agents':
      return executeListAgents();
    case 'report_agent_status':
      return executeReportAgentStatus(input as unknown as ReportAgentStatusInput);
    case 'ask_user_question':
      return executeAskUserQuestion(input as unknown as AskUserQuestionInput, storage);
    case 'join_plan_channel':
      return executeJoinPlanChannel(input as unknown as JoinPlanChannelInput);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

/** Input type for add_step */
interface AddStepInput {
  plan_id: string;
  title: string;
  description?: string;
  scope?: string;
  dependencies?: string[];
}

/** Input type for edit_step */
interface EditStepInput {
  plan_id: string;
  step_id: string;
  title?: string;
  description?: string;
  dependencies?: string[];
}

/** Input type for spawn_agent */
interface SpawnAgentInput {
  name: string;
  task: string;
  cwd?: string;
  initial_message?: string;
}

/** Input type for message_agent */
interface MessageAgentInput {
  agent_name: string;
  message: string;
}

/** Input type for report_agent_status */
interface ReportAgentStatusInput {
  agent_id: string;
  role: AgentRole;
  display_name?: string;
  state: AgentState;
  activity?: string;
  thought?: string;
}

/** Input type for ask_user_question */
interface AskUserQuestionInput {
  agent_id: string;
  agent_role: string;
  plan_id: string;
  text: string;
  context?: string;
  options?: string[];
  blocking_level?: 'hard_block' | 'soft_block' | 'preference' | 'fyi';
}

/** Input type for join_plan_channel */
interface JoinPlanChannelInput {
  agent_id: string;
  plan_id: string;
}

/**
 * Execute read_plan tool.
 */
async function executeReadPlan(
  input: { plan_id: string },
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Support partial IDs from channel names (e.g., "042265be" from "#plan-042265be")
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    const version = storage.getLatestVersion(plan.plan_id);
    if (!version) {
      return { success: false, error: `No version found for plan: ${plan.plan_id}` };
    }

    return {
      success: true,
      result: {
        plan_id: plan.plan_id,
        goal: version.summary.goal,
        context: version.summary.context,
        status: version.status,
        version: version.version,
        step_count: version.steps.length,
        steps: version.steps.map((s: Step) => ({
          step_id: s.step_id,
          title: s.title,
          description: s.description,
          scope: s.scope,
          dependencies: s.dependencies,
          owner_role: s.owner_role,
        })),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute list_plans tool.
 */
async function executeListPlans(
  input: { status?: string },
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    const plans = storage.listPlans();

    const filtered = input.status
      ? plans.filter((p) => {
          const version = storage.getLatestVersion(p.plan_id);
          return version?.status === input.status;
        })
      : plans;

    return {
      success: true,
      result: filtered.map((p) => {
        const version = storage.getLatestVersion(p.plan_id);
        return {
          plan_id: p.plan_id,
          goal: version?.summary.goal || 'No goal',
          status: version?.status || 'unknown',
          step_count: version?.steps.length || 0,
        };
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute add_step tool.
 */
async function executeAddStep(
  input: AddStepInput,
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Support partial IDs from channel names
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    const version = storage.getLatestVersion(plan.plan_id);
    if (!version) {
      return { success: false, error: `No version found for plan: ${plan.plan_id}` };
    }

    if (version.status !== 'draft') {
      return { success: false, error: `Cannot add steps to ${version.status} plan. Only draft plans can be modified.` };
    }

    const stepId = `step-${randomUUID().slice(0, 8)}`;
    const newStep: Step = {
      step_id: stepId,
      title: input.title,
      dependencies: input.dependencies || [],
    };
    if (input.description !== undefined) newStep.description = input.description;
    if (input.scope !== undefined) newStep.scope = input.scope;

    const now = new Date().toISOString();
    const newVersion: PlanVersion = {
      ...version,
      version: version.version + 1,
      steps: [...version.steps, newStep],
      updated_at: now,
    };

    storage.createVersion(newVersion);

    // Emit event for real-time UI updates
    emitPlanChange(plan.plan_id, newVersion.version, 'step_added', stepId);

    return {
      success: true,
      result: {
        step_id: stepId,
        title: input.title,
        message: `Added step "${input.title}" to plan`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute edit_step tool.
 */
async function executeEditStep(
  input: EditStepInput,
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Support partial IDs from channel names
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    const version = storage.getLatestVersion(plan.plan_id);
    if (!version) {
      return { success: false, error: `No version found for plan: ${plan.plan_id}` };
    }

    if (version.status !== 'draft') {
      return { success: false, error: `Cannot edit steps in ${version.status} plan. Only draft plans can be modified.` };
    }

    const existingStepIndex = version.steps.findIndex((s: Step) => s.step_id === input.step_id);
    if (existingStepIndex === -1) {
      return { success: false, error: `Step not found: ${input.step_id}` };
    }

    // Safe assertion: existingStepIndex !== -1 guarantees this element exists
    const existingStep = version.steps[existingStepIndex]!;
    const updatedStep: Step = {
      step_id: existingStep.step_id,
      title: input.title ?? existingStep.title,
      dependencies: input.dependencies ?? existingStep.dependencies,
      description: input.description ?? existingStep.description,
      scope: existingStep.scope,
      owner_role: existingStep.owner_role,
      acceptance_criteria: existingStep.acceptance_criteria,
      gate: existingStep.gate,
      sub_plan_id: existingStep.sub_plan_id,
    };

    const updatedSteps = [...version.steps];
    updatedSteps[existingStepIndex] = updatedStep;

    const now = new Date().toISOString();
    const newVersion: PlanVersion = {
      ...version,
      version: version.version + 1,
      steps: updatedSteps,
      updated_at: now,
    };

    storage.createVersion(newVersion);

    // Emit event for real-time UI updates
    emitPlanChange(plan.plan_id, newVersion.version, 'step_edited', input.step_id);

    return {
      success: true,
      result: {
        step_id: input.step_id,
        title: updatedStep.title,
        message: `Updated step "${updatedStep.title}"`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute spawn_agent tool.
 * Spawns a worker agent via the relay daemon.
 */
async function executeSpawnAgent(input: SpawnAgentInput): Promise<ToolResult> {
  try {
    // Check if agent with this name already exists
    if (isAgentSpawned(input.name)) {
      return {
        success: false,
        error: `Agent "${input.name}" is already spawned. Use a different name or release the existing agent first.`,
      };
    }

    const result = await spawnAgent({
      name: input.name,
      task: input.task,
      cwd: input.cwd,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to spawn agent',
      };
    }

    // Send initial message if provided
    if (input.initial_message) {
      sendMessage(input.name, input.initial_message, 'action');
    }

    return {
      success: true,
      result: {
        name: input.name,
        pid: result.pid,
        message: `Successfully spawned agent "${input.name}" with PID ${result.pid}. The agent is now ready to receive messages.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute release_agent tool.
 * Terminates a previously spawned agent.
 */
async function executeReleaseAgent(input: { name: string }): Promise<ToolResult> {
  try {
    if (!isAgentSpawned(input.name)) {
      return {
        success: false,
        error: `Agent "${input.name}" is not currently spawned or was not spawned by PlannerLead.`,
      };
    }

    const result = await releaseAgent(input.name);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to release agent',
      };
    }

    return {
      success: true,
      result: {
        name: input.name,
        message: `Successfully released agent "${input.name}".`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute message_agent tool.
 * Sends a message to another agent.
 */
async function executeMessageAgent(input: MessageAgentInput): Promise<ToolResult> {
  try {
    const sent = sendMessage(input.agent_name, input.message, 'action');

    if (!sent) {
      return {
        success: false,
        error: `Failed to send message to "${input.agent_name}". Not connected to relay or agent may not exist.`,
      };
    }

    return {
      success: true,
      result: {
        agent_name: input.agent_name,
        message: `Message sent to "${input.agent_name}".`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute list_agents tool.
 * Lists all agents spawned by PlannerLead.
 */
async function executeListAgents(): Promise<ToolResult> {
  try {
    const agents = getSpawnedAgents();

    if (agents.length === 0) {
      return {
        success: true,
        result: {
          agents: [],
          message: 'No agents are currently spawned.',
        },
      };
    }

    return {
      success: true,
      result: {
        agents: agents.map((a) => ({
          name: a.name,
          pid: a.pid,
          uptime: Math.round((Date.now() - a.spawnedAt.getTime()) / 1000),
        })),
        message: `${agents.length} agent(s) currently spawned.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

// === MCP Unified Interface Tool Handlers ===

/**
 * Execute report_agent_status tool.
 * Registers or updates agent state in the system.
 */
async function executeReportAgentStatus(input: ReportAgentStatusInput): Promise<ToolResult> {
  try {
    const activeAgentsMap = getActiveAgents();
    const isNew = !activeAgentsMap.has(input.agent_id);

    if (isNew) {
      // First call - register the agent
      if (!input.display_name) {
        return {
          success: false,
          error: 'display_name is required on first call to register agent',
        };
      }

      emitAgentJoined(input.agent_id, input.role, input.display_name);

      // If not idle, also emit status update
      if (input.state !== 'idle') {
        emitAgentStatusUpdate(input.agent_id, input.state, {
          activity: input.activity,
          thought: input.thought,
        });
      }

      return {
        success: true,
        result: {
          agent_id: input.agent_id,
          registered: true,
          state: input.state,
          message: `Agent "${input.display_name}" registered with role ${input.role} in state ${input.state}`,
        },
      };
    } else {
      // Subsequent call - update state
      emitAgentStatusUpdate(input.agent_id, input.state, {
        activity: input.activity,
        thought: input.thought,
      });

      return {
        success: true,
        result: {
          agent_id: input.agent_id,
          registered: false,
          state: input.state,
          message: `Agent state updated to ${input.state}`,
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute ask_user_question tool.
 * Creates a question in the queue and sets agent state to needs_input.
 */
async function executeAskUserQuestion(
  input: AskUserQuestionInput,
  storage: PlanStorage
): Promise<ToolResult> {
  try {
    // Validate plan exists
    const plan = findPlanByIdPrefix(storage, input.plan_id);
    if (!plan) {
      return { success: false, error: `Plan not found: ${input.plan_id}` };
    }

    // Create question using domain function
    const question = createQuestionEntity({
      plan_id: plan.plan_id,
      agent_id: input.agent_id,
      agent_role: input.agent_role,
      text: input.text,
      context: input.context,
      options: input.options,
      blocking_level: input.blocking_level ?? 'soft_block',
    });

    // Store the question
    storage.createQuestion(question);

    // Emit SSE event for real-time UI updates
    emitQuestionEvent(plan.plan_id, question.question_id, 'question_added', question);

    // Broadcast to relay for WebSocket clients (StatusBar pendingQuestions counter)
    sendMessage('*', 'question_added', 'question_event', {
      type: 'question_added',
      questionId: question.question_id,
      planId: plan.plan_id,
      agentId: input.agent_id,
      question,
    });

    // Update agent state to needs_input
    emitAgentStatusUpdate(input.agent_id, 'needs_input', {
      activity: `Waiting for answer: ${input.text}`,
    });

    return {
      success: true,
      result: {
        question_id: question.question_id,
        plan_id: plan.plan_id,
        agent_id: input.agent_id,
        message: `Question submitted. Your state has been set to needs_input.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Execute join_plan_channel tool.
 * Joins the agent to a plan's relay channel.
 */
async function executeJoinPlanChannel(input: JoinPlanChannelInput): Promise<ToolResult> {
  try {
    const client = getClient();
    if (!client) {
      return {
        success: false,
        error: 'Not connected to relay daemon',
      };
    }

    const channel = `#plan-${input.plan_id.slice(0, 8)}`;
    const joined = client.adminJoinChannel(channel, input.agent_id);

    if (!joined) {
      return {
        success: false,
        error: `Failed to join channel ${channel}`,
      };
    }

    return {
      success: true,
      result: {
        agent_id: input.agent_id,
        channel,
        message: `Successfully joined channel ${channel}`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Get mock tool result for demo mode.
 */
export function getMockToolResult(toolName: string, input: Record<string, unknown>): ToolResult {
  switch (toolName) {
    case 'read_plan':
      return {
        success: true,
        result: {
          plan_id: input.plan_id || 'demo-plan',
          goal: 'Demo plan goal - this is mock data',
          status: 'draft',
          step_count: 3,
          steps: [
            { step_id: 'step-1', title: 'First step', dependencies: [] },
            { step_id: 'step-2', title: 'Second step', dependencies: ['step-1'] },
            { step_id: 'step-3', title: 'Third step', dependencies: ['step-2'] },
          ],
        },
      };
    case 'list_plans':
      return {
        success: true,
        result: [
          { plan_id: 'demo-1', goal: 'Demo plan 1', status: 'draft', step_count: 3 },
          { plan_id: 'demo-2', goal: 'Demo plan 2', status: 'approved', step_count: 5 },
        ],
      };
    case 'add_step':
      return {
        success: true,
        result: {
          step_id: 'mock-step-id',
          title: input.title || 'New step',
          message: '[Mock] Step would be added in production',
        },
      };
    case 'edit_step':
      return {
        success: true,
        result: {
          step_id: input.step_id || 'mock-step-id',
          title: input.title || 'Edited step',
          message: '[Mock] Step would be updated in production',
        },
      };
    case 'spawn_agent':
      return {
        success: true,
        result: {
          name: input.name || 'mock-agent',
          pid: 12345,
          message: '[Mock] Agent would be spawned in production',
        },
      };
    case 'release_agent':
      return {
        success: true,
        result: {
          name: input.name || 'mock-agent',
          message: '[Mock] Agent would be released in production',
        },
      };
    case 'message_agent':
      return {
        success: true,
        result: {
          agent_name: input.agent_name || 'mock-agent',
          message: '[Mock] Message would be sent in production',
        },
      };
    case 'list_agents':
      return {
        success: true,
        result: {
          agents: [
            { name: 'mock-worker-1', pid: 12345, uptime: 120 },
            { name: 'mock-worker-2', pid: 12346, uptime: 60 },
          ],
          message: '[Mock] 2 agent(s) currently spawned.',
        },
      };
    case 'report_agent_status':
      return {
        success: true,
        result: {
          agent_id: input.agent_id || 'mock-agent',
          registered: true,
          state: input.state || 'idle',
          message: '[Mock] Agent status would be registered/updated in production',
        },
      };
    case 'ask_user_question':
      return {
        success: true,
        result: {
          question_id: 'mock-question-id',
          plan_id: String(input.plan_id || 'mock-plan'),
          agent_id: String(input.agent_id || 'mock-agent'),
          message: '[Mock] Question would be submitted in production',
        },
      };
    case 'join_plan_channel':
      return {
        success: true,
        result: {
          agent_id: input.agent_id || 'mock-agent',
          channel: `#plan-${String(input.plan_id || 'mock').slice(0, 8)}`,
          message: '[Mock] Would join channel in production',
        },
      };
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

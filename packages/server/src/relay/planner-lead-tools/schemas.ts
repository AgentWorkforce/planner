/**
 * Tool schemas in Anthropic API format.
 */

import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tool schemas for PlannerLead tools.
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
          description: 'Optional scope — infer from the project context (e.g., "ui", "networking", "storage", "rendering", "api", "testing")',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of step IDs this step depends on',
        },
        owner_role: {
          type: 'string',
          description: 'Optional owner role (e.g., "Coder", "Designer", "Architect")',
        },
        acceptance_criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['id', 'description'],
          },
          description: 'Optional acceptance criteria for the step',
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
        scope: {
          type: 'string',
          description: 'New scope — infer from the project context (e.g., "ui", "networking", "storage", "rendering", "api", "testing") (optional)',
        },
        owner_role: {
          type: 'string',
          description: 'New owner role (e.g., "Coder", "Designer", "Architect") (optional)',
        },
        acceptance_criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['id', 'description'],
          },
          description: 'New acceptance criteria for the step (optional)',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'remove_step',
    description: 'Remove a step from a draft plan. Only works on draft plans. Use when a step is unnecessary, duplicate, or should be consolidated into another step.',
    input_schema: {
      type: 'object' as const,
      properties: {
        plan_id: {
          type: 'string',
          description: 'The ID of the plan containing the step',
        },
        step_id: {
          type: 'string',
          description: 'The ID of the step to remove',
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
  {
    name: 'ask_domain_expert',
    description:
      'Ask the domain expert (Interviewer) a question about the plan context. The Interviewer has deep knowledge from the brainstorming session including understanding, specialist perspectives, and user decisions. Use this BEFORE ask_user_question for domain/technical questions. Only escalate to ask_user_question for decisions that truly need human input.',
    input_schema: {
      type: 'object' as const,
      properties: {
        plan_id: {
          type: 'string',
          description: 'The plan ID to ask about',
        },
        question: {
          type: 'string',
          description: 'The question to ask the domain expert',
        },
        context: {
          type: 'string',
          description: 'Optional additional context for the question',
        },
      },
      required: ['plan_id', 'question'],
    },
  },
];

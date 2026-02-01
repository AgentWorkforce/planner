import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { createStep, validateStepDag, type Step } from '../../domain/step.js';
import { PlanStatus } from '../../domain/status.js';
import { createImprovement, type ImprovementType } from '../../domain/improvement.js';
import { createQuestion as createQuestionEntity } from '../../domain/question.js';
import { emitQuestionEvent } from '../../events/question-events.js';
import { success, error, toCallToolResult, type ToolResponse } from './types.js';
import {
  emitAgentJoined,
  emitAgentStatusUpdate,
  getActiveAgents,
  type AgentRole,
  type AgentState,
} from '../../relay/agent-status.js';
import { getClient, sendMessage } from '../../relay/client.js';
import { getPlanChannelId } from '../../relay/channels.js';
import { RoleContextSchema } from '../../domain/context.js';

/**
 * All available tools with their schemas.
 */
export const tools: Tool[] = [
  {
    name: 'list_plans',
    description:
      'List all plans, optionally filtered by status. Returns an array of plan summaries with plan_id, goal, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'approved', 'published'],
          description: 'Filter plans by version status',
        },
      },
    },
  },
  {
    name: 'read_plan',
    description:
      'Read a plan with its current (latest) version. Returns the full plan including: summary (goal, context), understanding (agent observations keyed by role), steps (each with optional specification per domain: architecture, design, testing, security), status, and version number for optimistic locking.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan to read',
        },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'create_plan',
    description:
      'Create a new plan with a draft version. Returns the created plan and version.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'The goal of the plan (required)',
        },
        context: {
          type: 'string',
          description: 'Additional context for the plan',
        },
      },
      required: ['goal'],
    },
  },
  {
    name: 'add_step',
    description:
      'Add a step to the latest draft version of a plan. Returns the updated version with the new step. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        title: {
          type: 'string',
          description: 'The title of the step (required)',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the step',
        },
        scope: {
          type: 'string',
          description: 'The scope (e.g., repo, team, domain) for this step',
        },
        owner_role: {
          type: 'string',
          description: 'The role responsible for this step (e.g., "backend:Coder")',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of step_ids this step depends on',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'title'],
    },
  },
  {
    name: 'edit_step',
    description:
      'Modify an existing step in the draft version. Only specified fields are updated; others are preserved. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step to edit',
        },
        title: {
          type: 'string',
          description: 'New title for the step',
        },
        description: {
          type: 'string',
          description: 'New description for the step',
        },
        scope: {
          type: 'string',
          description: 'New scope for the step',
        },
        owner_role: {
          type: 'string',
          description: 'New owner role for the step',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'remove_step',
    description:
      'Remove a step from the draft version. Also removes this step_id from other steps\' dependencies. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step to remove',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'set_dependencies',
    description:
      'Set the dependencies for a step. Validates that all dependency step_ids exist and no cycles are created. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of step_ids this step depends on',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id', 'dependencies'],
    },
  },
  {
    name: 'add_criteria',
    description:
      'Add an acceptance criterion to a step. Returns the updated step. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step',
        },
        description: {
          type: 'string',
          description: 'Description of the acceptance criterion',
        },
        type: {
          type: 'string',
          description: 'Type of criterion (e.g., "test", "review", "metric")',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id', 'description'],
    },
  },
  {
    name: 'add_gate',
    description:
      'Add a human approval gate to a step. Gates require explicit sign-off before proceeding. Supports optimistic locking via expected_version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        step_id: {
          type: 'string',
          description: 'The UUID of the step',
        },
        approver_role: {
          type: 'string',
          description: 'The role required to approve (e.g., "tech_lead")',
        },
        expected_version: {
          type: 'number',
          description: 'Expected version number for optimistic locking. If provided and version has changed, returns VERSION_CONFLICT error.',
        },
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'submit_plan',
    description:
      'Submit the latest draft version for review. Sets submitted_at timestamp.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan to submit',
        },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'suggest_improvement',
    description:
      'Suggest an improvement to the plan. Creates a pending improvement that can be accepted or dismissed by the user. Use this when you notice issues or opportunities to enhance the plan quality.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        version: {
          type: 'number',
          description: 'The version number this improvement applies to',
        },
        type: {
          type: 'string',
          enum: [
            'missing_criteria',
            'unclear_description',
            'missing_dependency',
            'redundant_step',
            'scope_suggestion',
          ],
          description: 'Type of improvement being suggested',
        },
        description: {
          type: 'string',
          description: 'Human-readable explanation of the improvement',
        },
        step_id: {
          type: 'string',
          description: 'The step this improvement targets (if applicable)',
        },
        suggested_change: {
          type: 'object',
          description: 'Structured data describing the suggested change',
        },
      },
      required: ['plan_id', 'version', 'type', 'description'],
    },
  },
  {
    name: 'create_draft_version',
    description:
      'Create a new draft version from an existing approved or published version. Used by revision agents to create drafts for change request revisions. The new draft inherits the steps and summary from the source version.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        source_version: {
          type: 'number',
          description: 'The version number to create the draft from (must be approved or published)',
        },
        change_request_id: {
          type: 'string',
          description: 'The change request this draft is addressing (optional)',
        },
        revision_source: {
          type: 'string',
          enum: ['agent', 'human'],
          description: 'Who is creating this revision (default: "agent")',
        },
      },
      required: ['plan_id', 'source_version'],
    },
  },
  // Agent status tools - unified interface for all agents (persistent and spawned)
  {
    name: 'report_agent_status',
    description:
      'Report agent status to the system. On first call, registers the agent. On subsequent calls, updates state. Both persistent and spawned agents use this tool identically.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Unique identifier for this agent instance',
        },
        role: {
          type: 'string',
          enum: ['planner-lead', 'architect', 'ui-designer', 'data-modeler', 'coder', 'tester', 'security'],
          description: 'The agent\'s role for visual identification',
        },
        display_name: {
          type: 'string',
          description: 'Human-readable name shown in UI (required on first call)',
        },
        state: {
          type: 'string',
          enum: ['idle', 'working', 'needs_input', 'error'],
          description: 'Current state of the agent',
        },
        activity: {
          type: 'string',
          description: 'Description of current activity (e.g., "Processing user request")',
        },
        thought: {
          type: 'string',
          description: 'Current thought or question text (shown in UI popover)',
        },
      },
      required: ['agent_id', 'role', 'state'],
    },
  },
  {
    name: 'ask_user_question',
    description:
      'Ask a question to the user. Creates a question in the queue and sets the agent state to needs_input. Use this when you need user input to proceed.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent asking the question',
        },
        agent_role: {
          type: 'string',
          description: 'The role of the agent (e.g., "architect", "coder", "tester")',
        },
        plan_id: {
          type: 'string',
          description: 'The plan this question relates to',
        },
        text: {
          type: 'string',
          description: 'The question text',
        },
        blocking_level: {
          type: 'string',
          enum: ['hard_block', 'soft_block', 'preference', 'fyi'],
          description: 'How severely this blocks progress (default: soft_block)',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional predefined answer options for the user',
        },
        context: {
          type: 'string',
          description: 'Additional context to help the user answer',
        },
      },
      required: ['agent_id', 'agent_role', 'plan_id', 'text'],
    },
  },
  {
    name: 'join_plan_channel',
    description:
      'Join a plan channel to participate in plan discussions. Call this to enable messaging in a specific plan\'s channel.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent joining the channel',
        },
        plan_id: {
          type: 'string',
          description: 'The plan ID (channel will be #plan-{plan_id})',
        },
      },
      required: ['agent_id', 'plan_id'],
    },
  },
  {
    name: 'remove_criteria',
    description: 'Remove an acceptance criterion from a step',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The step ID' },
        criterion_id: { type: 'string', description: 'The criterion ID to remove' },
        expected_version: { type: 'number', description: 'Expected version for optimistic locking' }
      },
      required: ['plan_id', 'step_id', 'criterion_id']
    }
  },
  {
    name: 'edit_criteria',
    description: 'Edit an existing acceptance criterion on a step',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The step ID' },
        criterion_id: { type: 'string', description: 'The criterion ID to edit' },
        description: { type: 'string', description: 'New description for the criterion' },
        type: { type: 'string', description: 'New type for the criterion' },
        expected_version: { type: 'number', description: 'Expected version for optimistic locking' }
      },
      required: ['plan_id', 'step_id', 'criterion_id']
    }
  },
  {
    name: 'remove_gate',
    description: 'Remove an approval gate from a step',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The step ID' },
        expected_version: { type: 'number', description: 'Expected version for optimistic locking' }
      },
      required: ['plan_id', 'step_id']
    }
  },
  {
    name: 'approve_plan',
    description: 'Approve a plan, transitioning it from draft to approved status',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' }
      },
      required: ['plan_id']
    }
  },
  {
    name: 'publish_plan',
    description: 'Publish an approved plan, transitioning it to published status',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' }
      },
      required: ['plan_id']
    }
  },
  {
    name: 'update_understanding',
    description:
      'Update agent observations for a specific role in a plan. Use this to record insights, questions, or concerns discovered during ideation. Observations are merged with existing data for that role.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        role: { type: 'string', description: 'The agent role (e.g., "architect", "designer", "tester", "security")' },
        observations: { type: 'array', items: { type: 'string' }, description: 'List of observations or insights' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords or themes identified' },
        questions: { type: 'array', items: { type: 'string' }, description: 'Questions that arose during analysis' },
        concerns: { type: 'array', items: { type: 'string' }, description: 'Potential issues or risks identified' },
        references: { type: 'array', items: { type: 'string' }, description: 'References to relevant resources' },
        confidence: { type: 'string', enum: ['exploring', 'forming', 'confident'], description: 'Confidence level in observations' }
      },
      required: ['plan_id', 'role']
    }
  },
  {
    name: 'update_step_specification',
    description:
      'Update specification for a specific step and domain. Use this to add architecture decisions, design notes, test cases, or security considerations to a step.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        step_id: { type: 'string', description: 'The UUID of the step' },
        domain: { type: 'string', enum: ['architecture', 'design', 'testing', 'security'], description: 'The specification domain' },
        specification: { type: 'object', description: 'Domain-specific specification data (varies by domain)' }
      },
      required: ['plan_id', 'step_id', 'domain', 'specification']
    }
  },
  {
    name: 'get_plan_context',
    description:
      'Returns context for a plan version. Context captures formalized decisions by role at plan level (e.g., designer, architect, tester). Returns empty object if context is not set.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        version: { type: 'number', description: 'The version number (optional, defaults to latest)' }
      },
      required: ['plan_id']
    }
  },
  {
    name: 'update_plan_context',
    description:
      'Update context for a specific role in a plan. Context captures formalized decisions (e.g., designer decisions about theme, architect decisions about tech stack). Fields are merged with existing context for that role.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The UUID of the plan' },
        role: { type: 'string', description: 'The role (e.g., "designer", "architect", "tester", "security", or any custom role)' },
        fields: { type: 'object', description: 'Context fields to merge for this role (any key-value pairs)' }
      },
      required: ['plan_id', 'role', 'fields']
    }
  }
];

/**
 * Handle a tool call by name.
 */
export function handleToolCall(
  storage: PlanStorage,
  name: string,
  args: Record<string, unknown>
): CallToolResult {
  const response = executeToolCall(storage, name, args);
  return toCallToolResult(response);
}

function executeToolCall(
  storage: PlanStorage,
  name: string,
  args: Record<string, unknown>
): ToolResponse {
  switch (name) {
    case 'list_plans':
      return handleListPlans(storage, args);
    case 'read_plan':
      return handleReadPlan(storage, args);
    case 'create_plan':
      return handleCreatePlan(storage, args);
    case 'add_step':
      return handleAddStep(storage, args);
    case 'edit_step':
      return handleEditStep(storage, args);
    case 'remove_step':
      return handleRemoveStep(storage, args);
    case 'set_dependencies':
      return handleSetDependencies(storage, args);
    case 'add_criteria':
      return handleAddCriteria(storage, args);
    case 'add_gate':
      return handleAddGate(storage, args);
    case 'submit_plan':
      return handleSubmitPlan(storage, args);
    case 'suggest_improvement':
      return handleSuggestImprovement(storage, args);
    case 'create_draft_version':
      return handleCreateDraftVersion(storage, args);
    case 'report_agent_status':
      return handleReportAgentStatus(args);
    case 'ask_user_question':
      return handleAskUserQuestion(storage, args);
    case 'join_plan_channel':
      return handleJoinPlanChannel(args);
    case 'remove_criteria':
      return handleRemoveCriteria(storage, args);
    case 'edit_criteria':
      return handleEditCriteria(storage, args);
    case 'remove_gate':
      return handleRemoveGate(storage, args);
    case 'approve_plan':
      return handleApprovePlan(storage, args);
    case 'publish_plan':
      return handlePublishPlan(storage, args);
    case 'update_understanding':
      return handleUpdateUnderstanding(storage, args);
    case 'update_step_specification':
      return handleUpdateStepSpecification(storage, args);
    case 'get_plan_context':
      return handleGetPlanContext(storage, args);
    case 'update_plan_context':
      return handleUpdatePlanContext(storage, args);
    default:
      return error(`Unknown tool: ${name}`);
  }
}

// Tool handlers

/**
 * Error response for version conflict (structured for optimistic locking).
 */
interface VersionConflictResponse {
  success: false;
  error: 'VERSION_CONFLICT';
  message: string;
  expected_version: number;
  current_version: number;
}

/**
 * Check for version conflict and return error response if detected.
 * Returns null if no conflict (or no expected_version provided).
 */
function checkVersionConflict(
  expectedVersion: number | undefined,
  currentVersion: number
): VersionConflictResponse | null {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    return {
      success: false,
      error: 'VERSION_CONFLICT',
      message: 'Version has changed since last read. Re-read the plan before editing.',
      expected_version: expectedVersion,
      current_version: currentVersion,
    };
  }
  return null;
}

function handleListPlans(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const status = args.status as PlanStatus | undefined;
  const filter = status ? { status } : undefined;
  const plans = storage.listPlans(filter);

  const summaries = plans.map((plan) => {
    const version = storage.getLatestVersion(plan.plan_id);
    return {
      plan_id: plan.plan_id,
      goal: version?.summary.goal ?? '',
      status: version?.status ?? 'draft',
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    };
  });

  return success({ plans: summaries });
}

function handleReadPlan(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  if (!planId) {
    return error('plan_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const version = storage.getLatestVersion(planId);
  return success({ plan, version });
}

function handleCreatePlan(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const goal = args.goal as string;
  const context = args.context as string | undefined;

  if (!goal) {
    return error('goal is required');
  }

  // Get default org for plan creation
  const orgId = storage.listOrganizations().find((o) => o.slug === 'default')?.org_id;
  if (!orgId) {
    return error('Default organization not found');
  }

  const plan = createPlan(orgId);
  storage.createPlan(plan);

  const version = createPlanVersion(plan.plan_id, goal, context);
  storage.createVersion(version);

  return success({ plan, version });
}

function handleAddStep(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const title = args.title as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!title) {
    return error('title is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only add steps to draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  // Create new step
  const step = createStep(title, {
    description: args.description as string | undefined,
    scope: args.scope as string | undefined,
    owner_role: args.owner_role as string | undefined,
    dependencies: args.dependencies as string[] | undefined,
  });

  // Create new version with the step added
  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: [...latestVersion.steps, step],
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step });
}

function handleEditStep(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only edit steps in draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  // Update step with provided fields
  const existingStep = latestVersion.steps[stepIndex]!;
  const updatedStep: Step = {
    ...existingStep,
    ...(args.title !== undefined && { title: args.title as string }),
    ...(args.description !== undefined && { description: args.description as string }),
    ...(args.scope !== undefined && { scope: args.scope as string }),
    ...(args.owner_role !== undefined && { owner_role: args.owner_role as string }),
  };

  // Create new version with updated step
  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep });
}

function handleRemoveStep(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only remove steps from draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  // Remove step and clean up dependencies pointing to it
  const newSteps = latestVersion.steps
    .filter((s) => s.step_id !== stepId)
    .map((s) => ({
      ...s,
      dependencies: s.dependencies?.filter((d) => d !== stepId),
    }));

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion });
}

function handleSetDependencies(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const dependencies = args.dependencies as string[];
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!Array.isArray(dependencies)) {
    return error('dependencies must be an array');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only set dependencies in draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  // Validate all dependency IDs exist
  const stepIds = new Set(latestVersion.steps.map((s) => s.step_id));
  for (const depId of dependencies) {
    if (!stepIds.has(depId)) {
      return error(`Dependency step not found: ${depId}`);
    }
    if (depId === stepId) {
      return error('Step cannot depend on itself');
    }
  }

  // Create proposed steps to check for cycles
  const proposedSteps = latestVersion.steps.map((s, i) =>
    i === stepIndex ? { ...s, dependencies } : s
  );

  if (!validateStepDag(proposedSteps)) {
    return error('Setting these dependencies would create a cycle');
  }

  // Apply the change
  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = { ...newSteps[stepIndex]!, dependencies };

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: newSteps[stepIndex] });
}

function handleAddCriteria(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const description = args.description as string;
  const type = args.type as string | undefined;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!description) {
    return error('description is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only add criteria to draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const criterion = {
    id: crypto.randomUUID(),
    description,
    ...(type !== undefined && { type }),
  };

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: [...(existingStep.acceptance_criteria ?? []), criterion],
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep, criterion });
}

function handleAddGate(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const approverRole = args.approver_role as string | undefined;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only add gates to draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const updatedStep: Step = {
    ...existingStep,
    gate: {
      type: 'human_approval',
      ...(approverRole !== undefined && { approver_role: approverRole }),
    },
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep });
}

function handleRemoveGate(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only remove gates from draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;

  // Check if step has a gate to remove
  if (!existingStep.gate) {
    return error('Step does not have a gate to remove');
  }

  const updatedStep: Step = {
    ...existingStep,
    gate: undefined,
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep });
}

function handleRemoveCriteria(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const criterionId = args.criterion_id as string;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!criterionId) {
    return error('criterion_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only remove criteria from draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const acceptanceCriteria = existingStep.acceptance_criteria ?? [];

  const criterionIndex = acceptanceCriteria.findIndex((c) => c.id === criterionId);
  if (criterionIndex === -1) {
    return error(`Criterion not found: ${criterionId}`);
  }

  // Remove the criterion
  const updatedCriteria = acceptanceCriteria.filter((c) => c.id !== criterionId);

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: updatedCriteria,
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep });
}

function handleEditCriteria(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const criterionId = args.criterion_id as string;
  const description = args.description as string | undefined;
  const type = args.type as string | undefined;
  const expectedVersion = args.expected_version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!criterionId) {
    return error('criterion_id is required');
  }

  // Require at least one field to update
  if (description === undefined && type === undefined) {
    return error('At least one of description or type must be provided');
  }

  // Validate non-empty strings if provided
  if (description !== undefined && description.trim() === '') {
    return error('description cannot be empty');
  }
  if (type !== undefined && type.trim() === '') {
    return error('type cannot be empty');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only edit criteria in draft version');
  }

  // Optimistic locking check
  const conflict = checkVersionConflict(expectedVersion, latestVersion.version);
  if (conflict) {
    return conflict;
  }

  const stepIndex = latestVersion.steps.findIndex((s) => s.step_id === stepId);
  if (stepIndex === -1) {
    return error(`Step not found: ${stepId}`);
  }

  const existingStep = latestVersion.steps[stepIndex]!;
  const acceptanceCriteria = existingStep.acceptance_criteria ?? [];

  const criterionIndex = acceptanceCriteria.findIndex((c) => c.id === criterionId);
  if (criterionIndex === -1) {
    return error(`Criterion not found: ${criterionId}`);
  }

  // Update the criterion with provided fields
  const existingCriterion = acceptanceCriteria[criterionIndex]!;
  const updatedCriterion = {
    ...existingCriterion,
    ...(description !== undefined && { description }),
    ...(type !== undefined && { type }),
  };

  const updatedCriteria = [...acceptanceCriteria];
  updatedCriteria[criterionIndex] = updatedCriterion;

  const updatedStep: Step = {
    ...existingStep,
    acceptance_criteria: updatedCriteria,
  };

  const newSteps = [...latestVersion.steps];
  newSteps[stepIndex] = updatedStep;

  const now = new Date().toISOString();
  const newVersion = {
    ...latestVersion,
    version: latestVersion.version + 1,
    steps: newSteps,
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);
  return success({ version: newVersion, step: updatedStep, criterion: updatedCriterion });
}

function handleSubmitPlan(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;

  if (!planId) {
    return error('plan_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only submit draft versions');
  }
  if (latestVersion.submitted_at) {
    return error('Version is already submitted');
  }

  const updatedVersion = storage.submitVersion(planId, latestVersion.version);
  return success({ version: updatedVersion });
}

const VALID_IMPROVEMENT_TYPES = [
  'missing_criteria',
  'unclear_description',
  'missing_dependency',
  'redundant_step',
  'scope_suggestion',
] as const;

function handleSuggestImprovement(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const version = args.version as number;
  const type = args.type as string;
  const description = args.description as string;
  const stepId = args.step_id as string | undefined;
  const suggestedChange = args.suggested_change as Record<string, unknown> | undefined;

  if (!planId) {
    return error('plan_id is required');
  }
  if (version === undefined || version === null) {
    return error('version is required');
  }
  if (!type) {
    return error('type is required');
  }
  if (!description) {
    return error('description is required');
  }

  // Validate type
  if (!VALID_IMPROVEMENT_TYPES.includes(type as typeof VALID_IMPROVEMENT_TYPES[number])) {
    return error(`Invalid improvement type: ${type}. Must be one of: ${VALID_IMPROVEMENT_TYPES.join(', ')}`);
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const planVersion = storage.getVersion(planId, version);
  if (!planVersion) {
    return error(`Version ${version} not found for plan ${planId}`);
  }

  // If step_id is provided, validate it exists
  if (stepId) {
    const stepExists = planVersion.steps.some((s) => s.step_id === stepId);
    if (!stepExists) {
      return error(`Step not found: ${stepId}`);
    }
  }

  // Create the improvement
  const improvement = createImprovement({
    plan_id: planId,
    version,
    step_id: stepId,
    type: type as ImprovementType,
    description,
    suggested_change: suggestedChange,
  });

  storage.createImprovement(improvement);
  return success({ improvement });
}

function handleCreateDraftVersion(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const sourceVersion = args.source_version as number;
  const changeRequestId = args.change_request_id as string | undefined;
  const revisionSource = (args.revision_source as string) || 'agent';

  if (!planId) {
    return error('plan_id is required');
  }
  if (sourceVersion === undefined || sourceVersion === null) {
    return error('source_version is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const source = storage.getVersion(planId, sourceVersion);
  if (!source) {
    return error(`Version ${sourceVersion} not found for plan ${planId}`);
  }

  // Only allow creating draft from approved or published versions
  if (source.status !== PlanStatus.Approved && source.status !== PlanStatus.Published) {
    return error(`Can only create draft from approved or published versions. Current status: ${source.status}`);
  }

  // Get the latest version to determine the new version number
  const latestVersion = storage.getLatestVersion(planId);
  const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

  // Validate change request if provided
  if (changeRequestId) {
    const changeRequest = storage.getChangeRequest(changeRequestId);
    if (!changeRequest) {
      return error(`Change request not found: ${changeRequestId}`);
    }
    if (changeRequest.plan_id !== planId) {
      return error(`Change request ${changeRequestId} does not belong to plan ${planId}`);
    }
  }

  const now = new Date().toISOString();
  const newVersion = {
    plan_id: planId,
    version: newVersionNumber,
    status: PlanStatus.Draft,
    summary: { ...source.summary },
    steps: source.steps.map((step) => ({ ...step })),
    change_request_id: changeRequestId,
    metadata: {
      revision_source: revisionSource,
      source_version: sourceVersion,
    },
    created_at: now,
    updated_at: now,
  };

  storage.createVersion(newVersion);

  // Update change request to link the revision and set status
  if (changeRequestId) {
    // Update revision status to 'drafted'
    storage.updateChangeRequestRevisionStatus(changeRequestId, null, 'drafted');
  }

  return success({ version: newVersion });
}

// ============================================================================
// Agent Status Tool Handlers
// ============================================================================

function handleReportAgentStatus(args: Record<string, unknown>): ToolResponse {
  const agentId = args.agent_id as string;
  const role = args.role as AgentRole;
  const state = args.state as AgentState;
  const displayName = args.display_name as string | undefined;
  const activity = args.activity as string | undefined;
  const thought = args.thought as string | undefined;

  if (!agentId) {
    return error('agent_id is required');
  }
  if (!role) {
    return error('role is required');
  }
  if (!state) {
    return error('state is required');
  }

  // Validate state
  const validStates: AgentState[] = ['idle', 'working', 'needs_input', 'error'];
  if (!validStates.includes(state)) {
    return error(`Invalid state: ${state}. Must be one of: ${validStates.join(', ')}`);
  }

  // Check if agent is already registered
  const activeAgents = getActiveAgents();
  const isFirstReport = !activeAgents.has(agentId);

  if (isFirstReport) {
    // First report - register the agent
    if (!displayName) {
      return error('display_name is required on first status report (agent registration)');
    }
    emitAgentJoined(agentId, role, displayName);
  }

  // Update state (emitAgentJoined sets initial state to idle, so update if different or always for subsequent calls)
  if (!isFirstReport || state !== 'idle' || activity || thought) {
    emitAgentStatusUpdate(agentId, state, { activity, thought });
  }

  return success({
    agent_id: agentId,
    registered: isFirstReport,
    state,
  });
}

function handleAskUserQuestion(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const agentId = args.agent_id as string;
  const agentRole = args.agent_role as string;
  const planId = args.plan_id as string;
  const text = args.text as string;
  const blockingLevel = (args.blocking_level as string) || 'soft_block';
  const options = args.options as string[] | undefined;
  const context = args.context as string | undefined;

  if (!agentId) {
    return error('agent_id is required');
  }
  if (!agentRole) {
    return error('agent_role is required');
  }
  if (!planId) {
    return error('plan_id is required');
  }
  if (!text) {
    return error('text is required');
  }

  // Validate blocking_level
  const validLevels = ['hard_block', 'soft_block', 'preference', 'fyi'];
  if (!validLevels.includes(blockingLevel)) {
    return error(`Invalid blocking_level: ${blockingLevel}. Must be one of: ${validLevels.join(', ')}`);
  }

  // Verify plan exists
  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  // Create question using domain function (sets all defaults properly)
  const question = createQuestionEntity({
    plan_id: planId,
    agent_id: agentId,
    agent_role: agentRole,
    text,
    context,
    options,
    blocking_level: blockingLevel as 'hard_block' | 'soft_block' | 'preference' | 'fyi',
  });

  // Store the question
  storage.createQuestion(question);

  // Emit SSE event for real-time UI updates
  emitQuestionEvent(planId, question.question_id, 'question_added', question);

  // Broadcast to relay for WebSocket clients (StatusBar pendingQuestions counter)
  sendMessage('*', 'question_added', 'question_event', {
    type: 'question_added',
    questionId: question.question_id,
    planId,
    agentId,
    question,
  });

  // Set agent state to needs_input
  emitAgentStatusUpdate(agentId, 'needs_input', {
    activity: `Waiting for answer: ${text}`,
  });

  return success({
    question_id: question.question_id,
    agent_id: agentId,
    plan_id: planId,
    status: 'pending',
    message: 'Question submitted. Your state has been set to needs_input.',
  });
}

function handleJoinPlanChannel(args: Record<string, unknown>): ToolResponse {
  const agentId = args.agent_id as string;
  const planId = args.plan_id as string;

  if (!agentId) {
    return error('agent_id is required');
  }
  if (!planId) {
    return error('plan_id is required');
  }

  const client = getClient();
  if (!client) {
    return error('Not connected to relay daemon');
  }

  // Derive channel name from plan ID
  const channel = getPlanChannelId(planId);

  // Use adminJoinChannel to add the agent to the channel
  const joined = client.adminJoinChannel(channel, agentId);

  if (!joined) {
    return error(`Failed to join channel ${channel}`);
  }

  return success({
    channel,
    agent_id: agentId,
    joined: true,
  });
}

function handleApprovePlan(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;

  if (!planId) {
    return error('plan_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }

  if (latestVersion.status !== PlanStatus.Draft) {
    return error(`Cannot approve version in '${latestVersion.status}' status`);
  }

  if (!latestVersion.submitted_at) {
    return error('Version must be submitted before approval');
  }

  // Validate plan has at least one step
  if (latestVersion.steps.length === 0) {
    return error('Cannot approve plan with no steps');
  }

  // Create approval info
  const approvalInfo = {
    approver: 'system',
    approved_at: new Date().toISOString(),
  };

  const updatedVersion = storage.approveVersion(
    planId,
    latestVersion.version,
    approvalInfo
  );

  if (!updatedVersion) {
    return error('Failed to approve version');
  }

  return success({ version: updatedVersion });
}

function handlePublishPlan(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;

  if (!planId) {
    return error('plan_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }

  if (latestVersion.status !== PlanStatus.Approved) {
    return error(`Cannot publish version in '${latestVersion.status}' status. Version must be approved first.`);
  }

  const updatedVersion = storage.updateVersionStatus(
    planId,
    latestVersion.version,
    PlanStatus.Published
  );

  if (!updatedVersion) {
    return error('Failed to publish version');
  }

  return success({ version: updatedVersion });
}

// ============================================================================
// Understanding & Specification Tool Handlers
// ============================================================================

function handleUpdateUnderstanding(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const role = args.role as string;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!role) {
    return error('role is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only update understanding on draft versions');
  }

  // Build observations object from provided fields
  const observations: Record<string, unknown> = {};
  if (args.observations !== undefined) {
    observations.observations = args.observations;
  }
  if (args.keywords !== undefined) {
    observations.keywords = args.keywords;
  }
  if (args.questions !== undefined) {
    observations.questions = args.questions;
  }
  if (args.concerns !== undefined) {
    observations.concerns = args.concerns;
  }
  if (args.references !== undefined) {
    observations.references = args.references;
  }
  if (args.confidence !== undefined) {
    // Validate confidence value
    const validConfidence = ['exploring', 'forming', 'confident'];
    if (!validConfidence.includes(args.confidence as string)) {
      return error(`Invalid confidence: ${args.confidence}. Must be one of: ${validConfidence.join(', ')}`);
    }
    observations.confidence = args.confidence;
  }

  if (Object.keys(observations).length === 0) {
    return error('At least one observation field must be provided');
  }

  const updated = storage.updateVersionUnderstanding(
    planId,
    latestVersion.version,
    role,
    observations
  );

  if (!updated) {
    return error('Failed to update understanding');
  }

  return success({
    plan_id: planId,
    role,
    observations: updated.understanding?.[role] ?? {},
  });
}

function handleUpdateStepSpecification(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const stepId = args.step_id as string;
  const domain = args.domain as string;
  const specification = args.specification as Record<string, unknown>;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!stepId) {
    return error('step_id is required');
  }
  if (!domain) {
    return error('domain is required');
  }
  if (!specification || typeof specification !== 'object') {
    return error('specification is required and must be an object');
  }

  // Validate domain
  const validDomains = ['architecture', 'design', 'testing', 'security'];
  if (!validDomains.includes(domain)) {
    return error(`Invalid domain: ${domain}. Must be one of: ${validDomains.join(', ')}`);
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only update specification on draft versions');
  }

  // Check if step exists
  const step = latestVersion.steps.find((s) => s.step_id === stepId);
  if (!step) {
    return error(`Step not found: ${stepId}`);
  }

  const updated = storage.updateStepSpecification(
    planId,
    latestVersion.version,
    stepId,
    domain,
    specification
  );

  if (!updated) {
    return error('Failed to update specification');
  }

  const updatedStep = updated.steps.find((s) => s.step_id === stepId);
  const updatedSpec = (updatedStep?.specification as Record<string, unknown>)?.[domain];

  return success({
    plan_id: planId,
    step_id: stepId,
    domain,
    specification: updatedSpec ?? {},
  });
}

function handleGetPlanContext(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const version = args.version as number | undefined;

  if (!planId) {
    return error('plan_id is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  // Get specified version or latest
  const planVersion = version !== undefined
    ? storage.getVersion(planId, version)
    : storage.getLatestVersion(planId);

  if (!planVersion) {
    return error(version !== undefined
      ? `Version ${version} not found for plan ${planId}`
      : `No version found for plan ${planId}`
    );
  }

  // Return context or empty object if not set
  return success({
    plan_id: planId,
    version: planVersion.version,
    context: planVersion.context ?? {},
  });
}

function handleUpdatePlanContext(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const role = args.role as string;
  const fields = args.fields as Record<string, unknown>;

  if (!planId) {
    return error('plan_id is required');
  }
  if (!role) {
    return error('role is required');
  }
  if (!fields || typeof fields !== 'object') {
    return error('fields is required and must be an object');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error('No version found for plan');
  }
  if (latestVersion.status !== PlanStatus.Draft) {
    return error('Can only update context on draft versions');
  }

  // Validate fields against RoleContextSchema
  // Note: RoleContextSchema is z.record(z.string(), z.unknown()) so any fields are valid
  // This validation is mainly for consistency with the pattern
  const validation = RoleContextSchema.safeParse(fields);
  if (!validation.success) {
    return error(`Invalid context fields: ${validation.error.message}`);
  }

  const updated = storage.updateVersionContext(
    planId,
    latestVersion.version,
    role,
    fields
  );

  if (!updated) {
    return error('Failed to update context');
  }

  return success({
    plan_id: planId,
    role,
    context: (updated.context as Record<string, Record<string, unknown>>)?.[role] ?? {},
  });
}

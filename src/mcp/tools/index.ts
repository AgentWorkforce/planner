import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { createStep, validateStepDag, type Step } from '../../domain/step.js';
import { PlanStatus } from '../../domain/status.js';
import { success, error, toCallToolResult, type ToolResponse } from './types.js';

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
      'Read a plan with its current (latest) version. Returns the full plan with all steps, summary, and status.',
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
      'Add a step to the latest draft version of a plan. Returns the updated version with the new step.',
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
      },
      required: ['plan_id', 'title'],
    },
  },
  {
    name: 'edit_step',
    description:
      'Modify an existing step in the draft version. Only specified fields are updated; others are preserved.',
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
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'remove_step',
    description:
      'Remove a step from the draft version. Also removes this step_id from other steps\' dependencies.',
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
      },
      required: ['plan_id', 'step_id'],
    },
  },
  {
    name: 'set_dependencies',
    description:
      'Set the dependencies for a step. Validates that all dependency step_ids exist and no cycles are created.',
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
      },
      required: ['plan_id', 'step_id', 'dependencies'],
    },
  },
  {
    name: 'add_criteria',
    description:
      'Add an acceptance criterion to a step. Returns the updated step.',
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
      },
      required: ['plan_id', 'step_id', 'description'],
    },
  },
  {
    name: 'add_gate',
    description:
      'Add a human approval gate to a step. Gates require explicit sign-off before proceeding.',
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
    default:
      return error(`Unknown tool: ${name}`);
  }
}

// Tool handlers

function handleListPlans(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const status = args.status as PlanStatus | undefined;
  const plans = storage.listPlans(status);

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

  const plan = createPlan();
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

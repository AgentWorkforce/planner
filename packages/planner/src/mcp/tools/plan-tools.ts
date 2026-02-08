/**
 * Plan CRUD tools - list, read, create, submit, approve, publish.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { PlanStatus } from '../../domain/status.js';
import { success, error, type ToolResponse } from './shared.js';

/**
 * Plan tool schemas.
 */
export const planTools: Tool[] = [
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
      'Read a plan with its current (latest) version. Returns the full plan with all steps, summary, status, and version number for optimistic locking.',
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
  }
];

/**
 * Tool handlers
 */

export function handleListPlans(
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

export function handleReadPlan(
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

export function handleCreatePlan(
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

  const version = createPlanVersion(plan.plan_id, goal, { context });
  storage.createVersion(version);

  return success({ plan, version });
}

export function handleSubmitPlan(
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

export function handleApprovePlan(
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

export function handlePublishPlan(
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

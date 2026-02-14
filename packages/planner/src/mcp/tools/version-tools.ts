/**
 * Version management tools - create draft versions.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PlanStorage } from '../../storage/interface.js';
import { PlanStatus } from '../../domain/status.js';
import { PlanVersionSchema } from '../../domain/plan.js';
import { success, error, type ToolResponse } from './shared.js';

/**
 * Version tool schemas.
 */
export const versionTools: Tool[] = [
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
  {
    name: 'restore_version',
    description:
      'Restore an older version by creating a new draft with its content. Use when a recent version was created incorrectly (e.g., bad graduation overwrote refined steps) and you need to recover from a previous good version. The new version gets the next version number — history is preserved, nothing is deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          description: 'The UUID of the plan',
        },
        version: {
          type: 'number',
          description: 'The version number to restore from',
        },
      },
      required: ['plan_id', 'version'],
    },
  },
];

/**
 * Tool handlers
 */

export function handleCreateDraftVersion(
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

export function handleRestoreVersion(
  storage: PlanStorage,
  args: Record<string, unknown>
): ToolResponse {
  const planId = args.plan_id as string;
  const versionNum = args.version as number;

  if (!planId) {
    return error('plan_id is required');
  }
  if (versionNum === undefined || versionNum === null) {
    return error('version is required');
  }

  const plan = storage.getPlan(planId);
  if (!plan) {
    return error(`Plan not found: ${planId}`);
  }

  const sourceVersion = storage.getVersion(planId, versionNum);
  if (!sourceVersion) {
    return error(`Version ${versionNum} not found for plan ${planId}`);
  }

  const latestVersion = storage.getLatestVersion(planId);
  if (!latestVersion) {
    return error(`No versions found for plan ${planId}`);
  }

  if (sourceVersion.version === latestVersion.version) {
    return error('Cannot restore: this is already the latest version');
  }

  const now = new Date().toISOString();
  const restoredVersion = PlanVersionSchema.parse({
    plan_id: planId,
    version: latestVersion.version + 1,
    status: PlanStatus.Draft,
    summary: { ...sourceVersion.summary },
    steps: sourceVersion.steps.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
    decomposition_config: sourceVersion.decomposition_config,
    understanding: sourceVersion.understanding,
    context: sourceVersion.context,
    metadata: {
      ...sourceVersion.metadata,
      restored_from_version: sourceVersion.version,
    },
    created_at: now,
    updated_at: now,
  });

  storage.createVersion(restoredVersion);

  return success({
    version: restoredVersion,
    restored_from: sourceVersion.version,
  });
}

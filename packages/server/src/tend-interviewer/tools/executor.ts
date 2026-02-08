/**
 * Tend Tool Executor
 *
 * Executes tend tools by calling appropriate storage/API endpoints.
 * Routes to ideation/planner/forge based on tool category.
 */

import crypto from 'node:crypto';
import type { IdeationStorage } from '@plannr/ideation/storage/index.js';
import type { PlanStorage } from '@plannr/planner/storage/interface.js';
import type { ForgeStorage } from '@plannr/forge-core/storage/interface.js';
import type { ProjectStorage } from '../../api/project-storage.js';
import type { ToolResult } from './index.js';

export interface ToolExecutorDeps {
  ideationStorage: IdeationStorage;
  plannerStorage: PlanStorage;
  forgeStorage: ForgeStorage;
  projectStorage: ProjectStorage;
  currentProjectId?: string; // Context for implicit project reference
}

/**
 * Execute a tend tool.
 */
export async function executeTendTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  try {
    // Route to appropriate handler based on tool name
    if (name.startsWith('spawn_specialist') || name.startsWith('read_blocks') ||
        name.startsWith('update_understanding') || name.startsWith('update_synthesis')) {
      return executeIdeationTool(name, input, deps);
    }

    if (name.startsWith('create_step') || name.startsWith('update_step') ||
        name.startsWith('add_dependency') || name.startsWith('suggest_scope')) {
      return executePlannerTool(name, input, deps);
    }

    if (name.startsWith('graduate_project') || name.startsWith('get_project_status') ||
        name.startsWith('update_focus')) {
      return executeBridgeTool(name, input, deps);
    }

    if (name.startsWith('ask_question') || name.startsWith('present_choices') ||
        name.startsWith('request_approval')) {
      return executeInteractionTool(name, input, deps);
    }

    return { success: false, error: `Unknown tool: ${name}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[tend-tool-executor] Error executing tool '${name}':`, error);
    return { success: false, error: message };
  }
}

/**
 * Execute ideation tools (delegate to ideation storage).
 */
async function executeIdeationTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  const { ideationStorage } = deps;

  switch (name) {
    case 'spawn_specialist': {
      const specialistType = input.specialist_type as string;
      const sessionId = input.session_id as string;
      // Specialist spawning requires relay infrastructure
      // For now, log the request and return acknowledgment
      console.log(`[tend-tool-executor] Specialist spawn requested: ${specialistType} for session ${sessionId}`);
      return {
        success: true,
        data: {
          message: `Specialist spawn request noted: ${specialistType}`,
          status: 'pending',
        },
      };
    }

    case 'read_blocks': {
      const sessionId = input.session_id as string;
      const session = await ideationStorage.getSession(sessionId);
      if (!session) {
        return { success: false, error: `Session not found: ${sessionId}` };
      }
      return { success: true, data: { blocks: session.blocks } };
    }

    case 'update_understanding': {
      const sessionId = input.session_id as string;
      const specialistName = input.specialist_name as string;
      const observations = input.observations as Record<string, unknown>;

      const session = await ideationStorage.updateUnderstanding(
        sessionId,
        specialistName,
        observations
      );
      return { success: true, data: { updated: true } };
    }

    case 'update_synthesis': {
      const sessionId = input.session_id as string;
      const ideaSummary = input.idea_summary as string;
      const specialistPerspectives = input.specialist_perspectives as Record<string, unknown>;

      const session = await ideationStorage.updateSynthesis(sessionId, {
        idea_summary: ideaSummary,
        specialist_perspectives: specialistPerspectives,
      });
      return { success: true, data: { updated: true } };
    }

    default:
      return { success: false, error: `Unknown ideation tool: ${name}` };
  }
}

/**
 * Execute planner tools (delegate to planner storage).
 */
async function executePlannerTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  const { plannerStorage, projectStorage, currentProjectId } = deps;

  // Get plan_id from current project
  if (!currentProjectId) {
    return { success: false, error: 'No project context available' };
  }

  const project = await projectStorage.getProject(currentProjectId);
  if (!project || !project.plan_id) {
    return { success: false, error: 'Project has no associated plan' };
  }

  const planId = project.plan_id;

  switch (name) {
    case 'create_step': {
      const title = input.title as string;
      const description = input.description as string | undefined;
      const scope = input.scope as string | undefined;
      const ownerRole = input.owner_role as string | undefined;
      const dependencies = (input.dependencies as string[]) || [];

      const latestVersion = plannerStorage.getLatestVersion(planId);
      if (!latestVersion) {
        return { success: false, error: 'No version found for plan' };
      }

      const newStepId = crypto.randomUUID();
      const newStep = {
        step_id: newStepId,
        title,
        dependencies,
        ...(description && { description }),
        ...(scope && { scope }),
        ...(ownerRole && { owner_role: ownerRole }),
      };

      const updatedSteps = [...latestVersion.steps, newStep];

      const newVersion = plannerStorage.createVersion({
        ...latestVersion,
        version: latestVersion.version + 1,
        steps: updatedSteps,
        updated_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: { step_id: newStepId, version: newVersion.version },
      };
    }

    case 'update_step': {
      const stepId = input.step_id as string;
      const updates = input.updates as Record<string, unknown>;

      const latestVersion = plannerStorage.getLatestVersion(planId);
      if (!latestVersion) {
        return { success: false, error: 'No version found for plan' };
      }

      const stepIndex = latestVersion.steps.findIndex(
        (s: Record<string, unknown>) => s.step_id === stepId
      );
      if (stepIndex === -1) {
        return { success: false, error: `Step not found: ${stepId}` };
      }

      const updatedSteps = [...latestVersion.steps];
      updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...updates };

      const newVersion = plannerStorage.createVersion({
        ...latestVersion,
        version: latestVersion.version + 1,
        steps: updatedSteps,
        updated_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: { step_id: stepId, version: newVersion.version },
      };
    }

    case 'add_dependency': {
      const stepId = input.step_id as string;
      const dependsOn = input.depends_on as string;

      const latestVersion = plannerStorage.getLatestVersion(planId);
      if (!latestVersion) {
        return { success: false, error: 'No version found for plan' };
      }

      const stepIndex = latestVersion.steps.findIndex(
        (s: Record<string, unknown>) => s.step_id === stepId
      );
      if (stepIndex === -1) {
        return { success: false, error: `Step not found: ${stepId}` };
      }

      // Check target dependency exists
      const depExists = latestVersion.steps.some(
        (s: Record<string, unknown>) => s.step_id === dependsOn
      );
      if (!depExists) {
        return { success: false, error: `Dependency step not found: ${dependsOn}` };
      }

      const updatedSteps = [...latestVersion.steps];
      const existingDeps = (updatedSteps[stepIndex].dependencies as string[]) || [];
      if (!existingDeps.includes(dependsOn)) {
        updatedSteps[stepIndex] = {
          ...updatedSteps[stepIndex],
          dependencies: [...existingDeps, dependsOn],
        };
      }

      const newVersion = plannerStorage.createVersion({
        ...latestVersion,
        version: latestVersion.version + 1,
        steps: updatedSteps,
        updated_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: { step_id: stepId, depends_on: dependsOn, version: newVersion.version },
      };
    }

    case 'suggest_scope': {
      // This is informational - just acknowledge
      return {
        success: true,
        data: {
          message: 'Scope suggestion noted',
          scope_name: input.scope_name,
        },
      };
    }

    default:
      return { success: false, error: `Unknown planner tool: ${name}` };
  }
}

/**
 * Execute bridge tools (cross-phase operations).
 */
async function executeBridgeTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  const { projectStorage, currentProjectId } = deps;

  if (!currentProjectId) {
    return { success: false, error: 'No project context available' };
  }

  switch (name) {
    case 'graduate_project': {
      const target = input.target as 'ideation' | 'planning' | 'forging';
      const blockIds = input.block_ids as string[] | undefined;

      try {
        const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        const body: Record<string, unknown> = { target };
        if (blockIds && blockIds.length > 0) {
          body.options = { block_ids: blockIds };
        }

        const response = await fetch(`${baseUrl}/api/projects/${currentProjectId}/graduate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, error: `Graduation failed: ${errorText}` };
        }

        const result = await response.json();
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Graduation request failed: ${message}` };
      }
    }

    case 'get_project_status': {
      const project = await projectStorage.getProject(currentProjectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      return { success: true, data: { project } };
    }

    case 'update_focus': {
      const focusType = input.focus_type as string;
      const focusId = input.focus_id as string;

      await projectStorage.updateProject(currentProjectId, {
        current_focus: { focus_type: focusType, focus_id: focusId },
      });

      return { success: true, data: { updated: true } };
    }

    default:
      return { success: false, error: `Unknown bridge tool: ${name}` };
  }
}

/**
 * Execute interaction tools (user input requests).
 */
async function executeInteractionTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<ToolResult> {
  switch (name) {
    case 'ask_question': {
      // TODO: Queue question for ReplyBar
      return {
        success: true,
        data: {
          queued: true,
          question: input.question,
        },
      };
    }

    case 'present_choices': {
      // TODO: Queue choices for MultipleChoiceInput
      return {
        success: true,
        data: {
          queued: true,
          choices: input.choices,
        },
      };
    }

    case 'request_approval': {
      const title = input.title as string;
      const description = input.description as string | undefined;

      try {
        // Create gate via forge API if project has a run
        const project = await deps.projectStorage.getProject(deps.currentProjectId || '');
        if (!project || !project.run_id) {
          return { success: false, error: 'Project has no active forge run' };
        }

        const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        const response = await fetch(`${baseUrl}/api/forge/runs/${project.run_id}/gates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            agent_name: 'tend-interviewer',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, error: `Failed to create approval gate: ${errorText}` };
        }

        const result = await response.json();
        return { success: true, data: { gate_id: result.id || result.gate_id, queued: true } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Approval request failed: ${message}` };
      }
    }

    default:
      return { success: false, error: `Unknown interaction tool: ${name}` };
  }
}

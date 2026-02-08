/**
 * Tend Interviewer Service
 *
 * THIN wrapper around IdeationInterviewerService that adds phase-aware tool routing.
 * This is NOT a rewrite - it delegates to the real ideation interviewer for core conversation.
 *
 * Responsibilities:
 * - Route messages to #project-{projectId} channels
 * - Extend tool set with planning + forging tools based on project phase
 * - Enrich system prompt with project context and current focus
 * - Subscribe to forge SSE events for trickle layer
 */

// NOTE: These are cross-package imports - require proper module resolution
// The interviewer service from ideation package is the real implementation
// This is a THIN wrapper that adds phase-aware context

// For now, use type-only imports to avoid circular dependencies
// Actual implementation will require the packages to be built
export interface IdeationStorage {
  getSession(id: string): Promise<Record<string, unknown> | null>;
  updateUnderstanding(sessionId: string, specialistName: string, observations: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateSynthesis(sessionId: string, synthesis: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface PlanStorage {
  getLatestVersion(planId: string): Promise<Record<string, unknown> | null>;
}

export interface ForgeStorage {
  // Forge storage interface - to be defined
}

export interface ProjectStorage {
  getProject(id: string): Promise<Record<string, unknown> | null>;
  updateProject(id: string, updates: Record<string, unknown>): Promise<Record<string, unknown>>;
}
import { getTendSystemPrompt } from './prompt.js';
import { TEND_TOOLS, type TendToolInput } from './tools/index.js';
import { executeTendTool } from './tools/executor.js';

// =============================================================================
// Types
// =============================================================================

export interface TendInterviewerDeps {
  ideationStorage: IdeationStorage;
  plannerStorage: PlanStorage;
  forgeStorage: ForgeStorage;
  projectStorage: ProjectStorage;
}

export interface TendInterviewerState {
  isActive: boolean;
  ideationInterviewer: InterviewerService;
}

// =============================================================================
// Tend Interviewer Service (Wrapper)
// =============================================================================

class TendInterviewerService {
  private state: TendInterviewerState | null = null;
  private deps: TendInterviewerDeps | null = null;

  /**
   * Initialize the Tend Interviewer service.
   * This wraps the ideation InterviewerService with phase-aware extensions.
   */
  init(deps: TendInterviewerDeps): void {
    this.deps = deps;

    // Create ideation interviewer instance with ideation storage
    const ideationInterviewer = new InterviewerService();

    // Initialize with ideation dependencies
    const ideationDeps: InterviewerDeps = {
      storage: deps.ideationStorage,
      // spawnAgent and plannerClient will be injected later
    };

    ideationInterviewer.init(ideationDeps);

    this.state = {
      isActive: true,
      ideationInterviewer,
    };

    console.log('[TendInterviewer] Initialized (wrapping ideation interviewer)');
  }

  /**
   * Stop the Tend Interviewer service.
   */
  stop(): void {
    if (this.state?.ideationInterviewer) {
      this.state.ideationInterviewer.stop();
    }
    if (this.state) {
      this.state.isActive = false;
    }
    console.log('[TendInterviewer] Stopped');
  }

  /**
   * Check if the Tend Interviewer is active.
   */
  isActive(): boolean {
    return this.state?.isActive ?? false;
  }

  /**
   * Process a message for a project.
   * This is the main entry point that delegates to the ideation interviewer
   * with phase-aware context enrichment.
   *
   * @param projectId - The project ID
   * @param sessionId - The session ID (from project.session_id)
   * @param userMessage - The user's message
   */
  async processMessage(
    projectId: string,
    sessionId: string,
    userMessage: string
  ): Promise<string | null> {
    if (!this.deps || !this.state) {
      console.error('[TendInterviewer] Not initialized');
      return null;
    }

    // Get project for context
    const project = await this.deps.projectStorage.getProject(projectId);
    if (!project) {
      console.error(`[TendInterviewer] Project not found: ${projectId}`);
      return null;
    }

    // Build channel ID for this project
    const channelId = `#project-${projectId}`;

    // Get current focus for context enrichment
    const focusContext = await this.buildFocusContext(project);

    // Get pending forge events for trickle layer (if in forging phase)
    const forgeContext = project.run_id
      ? await this.buildForgeContext(project.run_id)
      : null;

    // Extend system prompt with project context
    const projectPromptExtension = getTendSystemPrompt({
      projectId,
      projectName: project.name,
      phase: this.determinePhase(project),
      focusContext,
      forgeContext,
    });

    // TODO: Inject extended tools based on phase
    // For now, delegate to ideation interviewer with original tools
    // Phase-aware tool routing will be added in next steps

    // Delegate to ideation interviewer
    return this.state.ideationInterviewer.handleMessage(
      channelId,
      userMessage,
      'tend-interviewer'
    );
  }

  /**
   * Determine the current phase of the project.
   */
  private determinePhase(project: Record<string, unknown>): 'ideation' | 'planning' | 'forging' {
    const hasRunId = project.run_id != null;
    const hasPlanId = project.plan_id != null;
    const hasSessionId = project.session_id != null;

    if (hasRunId) return 'forging';
    if (hasPlanId) return 'planning';
    if (hasSessionId) return 'ideation';
    return 'ideation'; // Default
  }

  /**
   * Build focus context from project.current_focus.
   */
  private async buildFocusContext(
    project: Record<string, unknown>
  ): Promise<string | null> {
    const currentFocus = project.current_focus as Record<string, unknown> | null;
    if (!currentFocus) return null;

    const focusType = currentFocus.focus_type as string;
    const focusId = currentFocus.focus_id as string;

    if (!focusType || !focusId || !this.deps) return null;

    // Build context based on focus type
    switch (focusType) {
      case 'step': {
        // Get step details from planner
        const planId = project.plan_id as string | null;
        if (!planId) return null;

        const plan = await this.deps.plannerStorage.getLatestVersion(planId);
        if (!plan) return null;

        const step = plan.steps.find((s: Record<string, unknown>) => s.step_id === focusId);
        if (!step) return null;

        return `Current focus: Step "${step.title}"\nStatus: ${step.status}\nDescription: ${step.description || 'N/A'}`;
      }

      case 'scope': {
        return `Current focus: Scope "${focusId}"\n(Scope details not yet implemented)`;
      }

      case 'block': {
        return `Current focus: Block "${focusId}"\n(Block details not yet implemented)`;
      }

      default:
        return null;
    }
  }

  /**
   * Build forge context from pending events.
   * This implements the "trickle layer" - buffering forge events for AI to surface.
   */
  private async buildForgeContext(runId: string): Promise<string | null> {
    if (!this.deps) return null;

    // TODO: Implement forge event buffering
    // For now, return null (will be implemented in uni07)
    return null;
  }

  /**
   * Set the spawnAgent function for spawning specialists.
   */
  setSpawnAgent(fn: InterviewerDeps['spawnAgent']): void {
    if (this.state?.ideationInterviewer) {
      this.state.ideationInterviewer.setSpawnAgent(fn);
      console.log('[TendInterviewer] spawnAgent function injected');
    } else {
      console.warn('[TendInterviewer] Cannot set spawnAgent: interviewer not initialized');
    }
  }
}

// Singleton instance
export const tendInterviewer = new TendInterviewerService();

// =============================================================================
// Convenience Functions
// =============================================================================

export function initTendInterviewer(deps: TendInterviewerDeps): void {
  tendInterviewer.init(deps);
}

export function stopTendInterviewer(): void {
  tendInterviewer.stop();
}

export function isTendInterviewerActive(): boolean {
  return tendInterviewer.isActive();
}

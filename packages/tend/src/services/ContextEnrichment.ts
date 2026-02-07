/**
 * Context enrichment for AI interviewer
 * Provides relevant project context based on current phase and focus
 */

export interface Focus {
  type: 'step' | 'scope' | 'session' | 'run' | 'none';
  id?: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  currentPhase: 'ideation' | 'planning' | 'execution';
  activePlan?: {
    id: string;
    title: string;
    version: number;
    status: string;
    stepCount: number;
  };
  activeSession?: {
    id: string;
    title: string;
    blockCount: number;
  };
  activeRun?: {
    id: string;
    name: string;
    status: string;
    completedSteps: number;
    totalSteps: number;
  };
}

export class ContextEnrichment {
  /**
   * Enriches context based on project state and current focus
   */
  enrichContext(project: ProjectContext, focus?: Focus): string {
    const sections: string[] = [];

    // Project overview
    sections.push(`## Project: ${project.name}`);
    sections.push(`Current Phase: ${project.currentPhase}`);
    sections.push('');

    // Phase-specific context
    switch (project.currentPhase) {
      case 'ideation':
        sections.push(...this.getIdeationContext(project));
        break;
      case 'planning':
        sections.push(...this.getPlanningContext(project));
        break;
      case 'execution':
        sections.push(...this.getExecutionContext(project));
        break;
    }

    // Focus-specific context
    if (focus && focus.type !== 'none') {
      sections.push('');
      sections.push(...this.getFocusContext(focus));
    }

    return sections.join('\n');
  }

  private getIdeationContext(project: ProjectContext): string[] {
    const lines: string[] = [];

    if (project.activeSession) {
      lines.push('## Active Ideation Session');
      lines.push(`Title: ${project.activeSession.title}`);
      lines.push(`Blocks captured: ${project.activeSession.blockCount}`);
      lines.push('');
      lines.push('In this phase, you should:');
      lines.push('- Help capture and refine ideas');
      lines.push('- Ask clarifying questions');
      lines.push('- Curate important blocks');
      lines.push('- Suggest when ready to graduate to planning');
    } else {
      lines.push('No active ideation session.');
      lines.push('Consider starting a session to begin brainstorming.');
    }

    return lines;
  }

  private getPlanningContext(project: ProjectContext): string[] {
    const lines: string[] = [];

    if (project.activePlan) {
      lines.push('## Active Plan');
      lines.push(`Title: ${project.activePlan.title}`);
      lines.push(`Version: ${project.activePlan.version}`);
      lines.push(`Status: ${project.activePlan.status}`);
      lines.push(`Steps: ${project.activePlan.stepCount}`);
      lines.push('');
      lines.push('In this phase, you should:');
      lines.push('- Help structure work into steps');
      lines.push('- Define dependencies and acceptance criteria');
      lines.push('- Organize steps by scope');
      lines.push('- Suggest when ready to approve and execute');
    } else {
      lines.push('No active plan.');
      lines.push('Consider creating a plan or graduating from ideation.');
    }

    return lines;
  }

  private getExecutionContext(project: ProjectContext): string[] {
    const lines: string[] = [];

    if (project.activeRun) {
      lines.push('## Active Execution Run');
      lines.push(`Name: ${project.activeRun.name}`);
      lines.push(`Status: ${project.activeRun.status}`);
      lines.push(`Progress: ${project.activeRun.completedSteps}/${project.activeRun.totalSteps} steps`);
      lines.push('');
      lines.push('In this phase, you should:');
      lines.push('- Monitor execution progress');
      lines.push('- Help interpret results');
      lines.push('- Suggest plan changes if issues arise');
      lines.push('- Track acceptance criteria validation');
    } else {
      lines.push('No active execution run.');
      lines.push('Consider graduating an approved plan to Forge.');
    }

    return lines;
  }

  private getFocusContext(focus: Focus): string[] {
    const lines: string[] = [];

    lines.push('## Current Focus');
    lines.push(`Type: ${focus.type}`);

    if (focus.id) {
      lines.push(`ID: ${focus.id}`);
    }

    lines.push('');
    lines.push('User is currently focused on this specific entity.');
    lines.push('Prioritize information and actions relevant to this focus.');

    return lines;
  }
}

/**
 * Specialist Spawner
 *
 * Creates a function that spawns specialist agents via the server relay.
 * Used by the Interviewer to spawn specialists on-demand.
 */

import type { SpawnResultPayload } from '@agent-relay/sdk';
import { sessionChannelId } from '../interviewer/config.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Signature matching the server relay's spawnAgent function.
 */
export interface SpawnAgentFn {
  (options: {
    name: string;
    task: string;
    cwd?: string;
    cli?: string;
  }): Promise<SpawnResultPayload>;
}

/**
 * Dependencies for creating the specialist spawner.
 */
export interface SpecialistSpawnerDeps {
  spawnAgent: SpawnAgentFn;
}

// =============================================================================
// Specialist Spawner Factory
// =============================================================================

/**
 * Creates a specialist spawner function that wraps the server relay's spawnAgent.
 * The returned function matches the InterviewerDeps.spawnAgent signature.
 */
export function createSpecialistSpawner(
  deps: SpecialistSpawnerDeps
): (sessionId: string, name: string, focus: string, context?: string) => Promise<string> {
  const { spawnAgent } = deps;

  return async (sessionId: string, name: string, focus: string, context?: string): Promise<string> => {
    const channelId = sessionChannelId(sessionId);
    const agentName = `Specialist-${name}-${sessionId.slice(0, 8)}`;

    const task = buildSpecialistPrompt(sessionId, channelId, name, focus, context);

    console.log(`[specialist-spawner] Spawning specialist ${agentName} for session ${sessionId}`);

    const result = await spawnAgent({
      name: agentName,
      cli: 'claude',
      task,
      cwd: process.cwd(),
    });

    if (!result.success) {
      console.error(`[specialist-spawner] Failed to spawn ${agentName}: ${result.error}`);
      throw new Error(`Failed to spawn specialist ${name}: ${result.error}`);
    }

    console.log(`[specialist-spawner] Successfully spawned ${result.name || agentName}`);
    return result.name || agentName;
  };
}

// =============================================================================
// Specialist Prompt Builder
// =============================================================================

/**
 * Builds the system prompt for a specialist agent.
 */
function buildSpecialistPrompt(
  sessionId: string,
  channelId: string,
  name: string,
  focus: string,
  context?: string
): string {
  return `You are a specialist agent named "${name}" participating in an ideation session.

## Your Core Purpose
**Analyze the conversation and contribute observations that help build Understanding for planners.**

Your insights will be distilled into the Understanding document - a structured summary of goals, constraints, requirements, and technical implications that planners use to create detailed plans.

## Your Expertise
Focus area: ${focus}

${context ? `## Additional Context\n${context}\n` : ''}
## Channel
You should join and observe: ${channelId}
Session ID: ${sessionId}

## Instructions

1. **Observe** the conversation between the Interviewer and the user
2. **Analyze** through the lens of your expertise (${focus})
3. **Contribute** when you identify relevant insights:
   - Send observations to the session channel (${channelId})
   - Use these formats:
     - \`[observation]: <your insight>\` - facts or patterns you notice
     - \`[question]: <your question>\` - things the Interviewer should explore
     - \`[concern]: <your concern>\` - potential issues or risks

4. **Stay invisible** - The Interviewer will weave your insights into the conversation naturally. NEVER address the user directly.

5. **Think like a planner** - What would someone planning this project need to know? Focus on:
   - Goals and success criteria
   - Constraints (technical, business, time)
   - Requirements (functional, non-functional)
   - Technical implications and dependencies
   - Risks and concerns

## Example Contributions

\`[observation]: The user mentioned OAuth2 - this suggests integration with external identity providers\`
\`[question]: What are the expected concurrent user limits? This affects architecture choices.\`
\`[concern]: No mention of error handling strategy - could lead to poor UX if not addressed\`

Begin by joining ${channelId} and listening to the conversation.`;
}

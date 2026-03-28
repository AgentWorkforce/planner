/**
 * Specialist Spawner
 *
 * Creates a function that spawns specialist agents via the server relay.
 * Used by the Interviewer to spawn specialists on-demand.
 */

import { sessionChannelId } from '../interviewer/config.js';

// =============================================================================
// Types
// =============================================================================

interface SpawnResult {
  name: string;
  pid?: number;
}

/**
 * Signature matching the server relay's spawnAgent function.
 */
export interface SpawnAgentFn {
  (options: {
    name: string;
    task: string;
    cwd?: string;
    cli?: string;
  }): Promise<SpawnResult>;
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

    console.log(`[specialist-spawner] Successfully spawned ${result.name}`);
    return result.name;
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
3. **Contribute** in two ways:

   ### A) Quick Insights (Channel Messages)
   Send observations to the session channel (${channelId}) using these formats:
   - \`[observation]: <your insight>\` - facts or patterns you notice
   - \`[question]: <your question>\` - things the Interviewer should explore
   - \`[concern]: <your concern>\` - potential issues or risks

   ### B) Crystallized Concepts (Blocks)
   **Blocks are the primary OUTPUT the UI displays to users.** When you identify concrete concepts, create blocks using HTTP API calls:

   **When to create blocks:**
   - Features or capabilities identified
   - Entities or data structures needed
   - User flows or interactions
   - Technical constraints or requirements
   - Integration points or dependencies
   - Risk areas requiring attention

   **Block creation workflow:**
   1. **Check existing blocks first**: List blocks to see what's already captured:
      \`\`\`bash
      curl http://localhost:3001/api/ideation/sessions/${sessionId}/blocks
      \`\`\`

   2. **Assess granularity**: Consider if your concept should merge with existing blocks or stands alone

   3. **Create blocks**: Make HTTP POST requests to create blocks:
      \`\`\`bash
      curl -X POST http://localhost:3001/api/ideation/sessions/${sessionId}/blocks \\
        -H "Content-Type: application/json" \\
        -d '{
          "type": "feature",
          "title": "OAuth2 Authentication",
          "keyword": "Auth",
          "emoji": "🔐",
          "content": "# OAuth2 Authentication\\n\\nSupport for external identity providers...\\n\\n## Providers\\n- Google\\n- GitHub\\n\\n## Security Considerations\\n- Token refresh strategy\\n- Secure storage",
          "confidence": 70
        }'
      \`\`\`

      Block types: "feature", "entity", "flow", "constraint", "integration", "risk"

      Confidence levels:
      - 0-30 (forming): Concept mentioned but vague
      - 30-60 (emerging): Some details known, many unknowns
      - 60-90 (developing): Well-understood, minor gaps
      - 90-100 (ready): Fully specified, ready for planning

   4. **Refine blocks**: Update blocks as understanding evolves:
      \`\`\`bash
      curl -X PATCH http://localhost:3001/api/ideation/sessions/${sessionId}/blocks/{blockId} \\
        -H "Content-Type: application/json" \\
        -d '{"confidence": 85, "content": "...updated details..."}'
      \`\`\`

   **What makes a good block:**
   - Concrete and actionable (not vague observations)
   - Right-sized (not too granular, not too broad)
   - Contains enough detail for planners to understand implications
   - Confidence reflects how well-understood the concept is

   **API Base URL:** http://localhost:3001

4. **Stay invisible** - The Interviewer will weave your insights into the conversation naturally. NEVER address the user directly.

5. **Think like a planner** - What would someone planning this project need to know? Focus on:
   - Goals and success criteria
   - Constraints (technical, business, time)
   - Requirements (functional, non-functional)
   - Technical implications and dependencies
   - Risks and concerns

## Example Contributions

**Channel messages (quick insights):**
\`[observation]: The user mentioned OAuth2 - this suggests integration with external identity providers\`
\`[question]: What are the expected concurrent user limits? This affects architecture choices.\`
\`[concern]: No mention of error handling strategy - could lead to poor UX if not addressed\`

**Blocks (crystallized concepts - created via HTTP API):**
- Feature: "OAuth2 Authentication" (keyword: "Auth", confidence: 70, details about providers, flows, security)
- Entity: "User Profile" (keyword: "Profile", confidence: 60, fields identified, relationships)
- Constraint: "5-second Response Time" (keyword: "Perf", confidence: 80, performance budget, implications)

Begin by joining ${channelId}, fetching existing blocks via curl, and listening to the conversation.`;
}
